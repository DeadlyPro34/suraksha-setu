"""Keyless driving routes from the public OSRM demo server."""

import logging
from typing import Any, Dict

import httpx


logger = logging.getLogger(__name__)
_OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
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


def get_directions(
    start_lat: float, start_lon: float, end_lat: float, end_lon: float
) -> Dict[str, Any]:
    """Return a mapped driving route and simple turn instructions from OSRM."""
    url = f"{_OSRM_URL}/{start_lon},{start_lat};{end_lon},{end_lat}"
    params = {"overview": "full", "geometries": "geojson", "steps": "true"}
    try:
        response = httpx.get(url, params=params, timeout=12.0)
        response.raise_for_status()
        raw = response.json()
        routes = raw.get("routes") or []
        if raw.get("code") != "Ok" or not routes:
            raise ValueError("OSRM response contains no route")
        route = routes[0]
        coordinates = route.get("geometry", {}).get("coordinates", [])
        if len(coordinates) < 2:
            raise ValueError("OSRM response contains no route geometry")
        steps = []
        for leg in route.get("legs", []):
            for step in leg.get("steps", []):
                maneuver = step.get("maneuver", {})
                name = step.get("name") or "the road"
                modifier = maneuver.get("modifier")
                action = maneuver.get("type", "continue").replace("_", " ")
                instruction = f"{action.capitalize()} {modifier} onto {name}" if modifier else f"{action.capitalize()} on {name}"
                steps.append({
                    "instruction": instruction,
                    "distance_km": round(float(step.get("distance", 0)) / 1000, 2),
                    "location": maneuver.get("location"),
                })
        return {
            "route_found": True,
            "distance_km": round(float(route["distance"]) / 1000, 2),
            "duration_min": round(float(route["duration"]) / 60, 1),
            "coordinates": coordinates,
            "steps": steps,
        }
    except Exception as exc:
        logger.info("Could not get driving directions (%s)", type(exc).__name__)
        return {"route_found": False, "distance_km": None, "duration_min": None, "coordinates": [], "steps": []}
