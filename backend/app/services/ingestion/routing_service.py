"""Keyless driving routes from the public OSRM demo server."""

import logging
from typing import Any, Dict, Optional

import httpx


logger = logging.getLogger(__name__)
_OSRM_URL = "http://router.project-osrm.org/route/v1/driving"
_FALLBACK: Dict[str, Any] = {
    "distance_km": None,
    "duration_min": None,
    "route_found": False,
}


def get_route(
    start_lat: float, start_lon: float, end_lat: float, end_lon: float
) -> Dict[str, Any]:
    """Return driving distance and duration, or a safe unavailable result."""
    url = (
        f"{_OSRM_URL}/{start_lon},{start_lat};{end_lon},{end_lat}"
    )
    params = {"overview": "false"}
    try:
        response = httpx.get(url, params=params, timeout=8.0)
        response.raise_for_status()
        raw = response.json()
        logger.info(
            "OSRM raw response for (%s, %s) -> (%s, %s): %s",
            start_lat,
            start_lon,
            end_lat,
            end_lon,
            raw,
        )
        routes = raw.get("routes") or []
        if raw.get("code") != "Ok" or not routes:
            raise ValueError("OSRM response contains no route")
        route = routes[0]
        distance_m = float(route["distance"])
        duration_s = float(route["duration"])
        if distance_m < 0 or duration_s < 0:
            raise ValueError("OSRM returned negative route metrics")
        return {
            "distance_km": round(distance_m / 1000.0, 2),
            "duration_min": round(duration_s / 60.0, 1),
            "route_found": True,
        }
    except Exception as exc:
        logger.info(
            "OSRM unavailable for (%s, %s) -> (%s, %s); using route fallback (%s)",
            start_lat,
            start_lon,
            end_lat,
            end_lon,
            type(exc).__name__,
        )
        return dict(_FALLBACK)
