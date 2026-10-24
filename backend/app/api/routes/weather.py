"""Public, cached OpenWeather conditions for the citizen safety dashboard."""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings

router = APIRouter(prefix="/api/weather", tags=["weather"])
_CACHE_TTL_SECONDS = 600
_CACHE_MAX_ITEMS = 256
_cache: dict[tuple[float, float], tuple[float, dict[str, Any]]] = {}
_cache_lock = asyncio.Lock()
_BASE_URL = "https://api.openweathermap.org/data/4.0/onecall"


def _number(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _iso_time(value: Any) -> str | None:
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError):
        return None


async def _provider_get(client: httpx.AsyncClient, path: str, params: dict[str, Any]) -> dict[str, Any]:
    response = await client.get(f"{_BASE_URL}/{path}", params={**params, "appid": settings.OPENWEATHER_API_KEY})
    if response.status_code == 401:
        raise HTTPException(status_code=503, detail="OpenWeather One Call access is not enabled for this key. Activate the One Call by Call subscription, then refresh weather.")
    if response.status_code == 429:
        raise HTTPException(status_code=503, detail="The OpenWeather request limit was reached. Weather will be available again after the limit resets.")
    if response.status_code >= 400:
        # Never forward provider response text; it may include request details.
        raise HTTPException(status_code=502, detail="Live weather is temporarily unavailable. Please try again later.")
    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Live weather returned an unreadable response.") from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Live weather returned an unreadable response.")
    return data


async def _load_weather(lat: float, lon: float) -> dict[str, Any]:
    if not settings.OPENWEATHER_API_KEY:
        raise HTTPException(status_code=503, detail="Weather updates are not configured yet. Add OPENWEATHER_API_KEY to the backend environment.")

    coords = {"lat": lat, "lon": lon, "units": "metric"}
    async with httpx.AsyncClient(timeout=8.0) as client:
        current, rain_minute, forecast = await asyncio.gather(
            _provider_get(client, "current", coords),
            _provider_get(client, "timeline/1min", coords),
            _provider_get(client, "timeline/1h", coords),
        )

        current_data = (current.get("data") or [{}])[0]
        condition = (current_data.get("weather") or [{}])[0]
        forecast_rows = forecast.get("data") or []
        # Keep precipitation probability and intensity separate; precipitation
        # is a rate (mm/h), not an accumulated rainfall total.
        hourly = []
        for item in forecast_rows[:12]:
            weather = (item.get("weather") or [{}])[0]
            rain = item.get("rain") or {}
            hourly.append({
                "time": _iso_time(item.get("dt")),
                "precipitation_probability": round((_number(item.get("pop")) or 0) * (100 if (_number(item.get("pop")) or 0) <= 1 else 1)),
                "rain_rate_mm_h": _number(rain.get("1h")),
                "condition": weather.get("description") or weather.get("main") or "Forecast",
            })

        alert_ids = list(dict.fromkeys(
            [str(item) for item in (current_data.get("alerts") or []) if isinstance(item, str)]
            + [str(alert_id) for row in forecast_rows for alert_id in (row.get("alerts") or []) if isinstance(alert_id, str)]
        ))[:5]
        alert_responses = await asyncio.gather(
            *(_provider_get(client, f"alert/{alert_id}", {}) for alert_id in alert_ids),
            return_exceptions=True,
        )
        alerts = []
        for alert in alert_responses:
            if not isinstance(alert, dict):
                continue
            description = alert.get("description")
            if isinstance(description, list):
                description = next((item.get("description") for item in description if isinstance(item, dict) and item.get("description") and str(item.get("language", "")).lower().startswith("en")), None) or next((item.get("description") for item in description if isinstance(item, dict) and item.get("description")), "")
            alerts.append({
                "event": str(alert.get("event") or "Weather alert")[:120],
                "sender": str(alert.get("sender_name") or "National weather agency")[:120],
                "description": str(description or "")[:2000],
                "starts_at": _iso_time(alert.get("start")),
                "ends_at": _iso_time(alert.get("end")),
                "tags": [str(tag)[:80] for tag in (alert.get("tags") or [])[:10]],
            })

    return {
        "latitude": round(lat, 1), "longitude": round(lon, 1),
        "source": "OpenWeather", "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "current": {
            "temperature_c": _number(current_data.get("temp")),
            "feels_like_c": _number(current_data.get("feels_like")),
            "humidity_pct": _number(current_data.get("humidity")),
            "wind_speed_m_s": _number(current_data.get("wind_speed")),
            "rain_rate_last_hour_mm_h": _number((current_data.get("rain") or {}).get("1h")),
            "condition": condition.get("description") or condition.get("main") or "Conditions unavailable",
            "icon": condition.get("icon"),
            "observed_at": _iso_time(current_data.get("dt")),
            "next_hour_peak_rain_rate_mm_h": max(
                (_number(item.get("precipitation")) or 0 for item in (rain_minute.get("data") or [])[:60]),
                default=0,
            ),
        },
        "forecast": hourly,
        "alerts": alerts,
        "alerts_data_available": all(isinstance(alert, dict) for alert in alert_responses),
    }


@router.get("")
async def get_weather(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
):
    # Coarse coordinates avoid storing or repeatedly sending precise GPS data.
    key = (round(lat, 1), round(lon, 1))
    now = time.monotonic()
    cached = _cache.get(key)
    if cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    # Public requests are limited to coarse-grid weather points and cached for
    # ten minutes to reduce provider calls; callers never supply the API key.
    try:
        payload = await _load_weather(*key)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Weather provider timed out. Please try again shortly.") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Weather provider could not be reached. Please try again shortly.") from exc

    async with _cache_lock:
        if len(_cache) >= _CACHE_MAX_ITEMS:
            oldest = min(_cache, key=lambda item: _cache[item][0])
            _cache.pop(oldest, None)
        _cache[key] = (time.monotonic(), payload)
    return payload
