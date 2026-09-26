"""Keyless precipitation forecasts from the Open-Meteo API."""

import logging
from typing import Any, Dict

import httpx


logger = logging.getLogger(__name__)
_OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
_FALLBACK = {
    "next_6h_mm": 0.0,
    "next_24h_mm": 0.0,
    "current_conditions": "weather data unavailable",
    "available": False,
}


def _conditions_for_precipitation(mm: float) -> str:
    if mm < 0.1:
        return "clear"
    if mm < 2.5:
        return "light rain"
    if mm < 7.6:
        return "moderate rain"
    return "heavy rain"


def get_precipitation_forecast(latitude: float, longitude: float) -> Dict[str, Any]:
    """Return forecast precipitation totals; no API key is required."""
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "precipitation",
        "forecast_days": 2,
    }
    try:
        response = httpx.get(_OPEN_METEO_URL, params=params, timeout=8.0)
        response.raise_for_status()
        raw = response.json()
        logger.info("Open-Meteo raw response for (%s, %s): %s", latitude, longitude, raw)

        precipitation = raw["hourly"]["precipitation"]
        if not isinstance(precipitation, list) or not precipitation:
            raise ValueError("Open-Meteo response has no hourly precipitation values")
        values = [float(value or 0.0) for value in precipitation]
        return {
            "next_6h_mm": round(sum(values[:6]), 2),
            "next_24h_mm": round(sum(values[:24]), 2),
            "current_conditions": _conditions_for_precipitation(values[0]),
            "available": True,
        }
    except Exception as exc:
        logger.info(
            "Open-Meteo unavailable for (%s, %s); using weather fallback (%s)",
            latitude,
            longitude,
            type(exc).__name__,
        )
        return dict(_FALLBACK)
