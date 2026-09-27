"""Classify 24-hour rainfall for an incident using IMD rainfall bands."""

import logging
import math
from typing import Any, Dict, Tuple

from app.agents.base import BaseAgent
from app.data.flood_prone_zones import FLOOD_PRONE_ZONES
from app.services.ingestion.weather_service import get_precipitation_forecast
from app.services.shelter_lookup import get_incident_coordinates


logger = logging.getLogger(__name__)
_MUMBAI_FALLBACK = (19.0760, 72.8777)
_EXTREMELY_HEAVY_MM = 204.4


def _severity_for_rainfall(next_24h_mm: float) -> str:
    """Map forecast rainfall to severity using IMD 24-hour rainfall bands.

    Source: India Meteorological Department 24-hour rainfall classification,
    as published in IMD bulletins (light <15.6; moderate 15.6–64.4;
    heavy 64.5–115.5; very heavy 115.6–204.4; extremely heavy >=204.5 mm).
    Here heavy maps to high, while very heavy and extremely heavy map to critical.
    """
    if next_24h_mm < 15.6:
        return "low"
    if next_24h_mm < 64.5:
        return "medium"
    if next_24h_mm < 115.6:
        return "high"
    return "critical"


def _flooded_percentage(next_24h_mm: float) -> float:
    """Scale rainfall against IMD's extremely-heavy-rainfall reference ceiling."""
    nonnegative_rainfall = max(0.0, next_24h_mm)
    return round(min(100.0, nonnegative_rainfall / _EXTREMELY_HEAVY_MM * 100.0), 2)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    value = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * radius_km * math.asin(math.sqrt(min(1.0, value)))


def _nearest_zone(latitude: float, longitude: float) -> str:
    zone = min(
        FLOOD_PRONE_ZONES,
        key=lambda item: _haversine_km(
            latitude, longitude, item["lat"], item["lon"]
        ),
    )
    return zone["name"]


class FloodAgent(BaseAgent):
    name = "flood_agent"

    def run(self, incident_id: str) -> Dict[str, Any]:
        try:
            coordinates = get_incident_coordinates(incident_id)
        except Exception as exc:
            logger.info(
                "Could not load incident coordinates; using Mumbai defaults (%s)",
                type(exc).__name__,
            )
            coordinates = None

        lat, lon = coordinates if coordinates else _MUMBAI_FALLBACK
        rainfall_forecast = get_precipitation_forecast(lat, lon)
        next_24h_mm = float(rainfall_forecast.get("next_24h_mm", 0.0) or 0.0)

        return {
            "severity": _severity_for_rainfall(next_24h_mm),
            "flooded_pct": _flooded_percentage(next_24h_mm),
            "rainfall_forecast": rainfall_forecast,
            "nearest_zone": _nearest_zone(lat, lon),
            "_debug_location_used": {"lat": lat, "lon": lon},
        }
