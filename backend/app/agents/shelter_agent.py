"""Find the nearest open shelter and report its capacity and amenities."""

import logging
from typing import Any, Dict

from app.agents.base import BaseAgent
from app.services.shelter_lookup import (
    find_nearest_shelter,
    get_incident_coordinates,
)


logger = logging.getLogger(__name__)


class ShelterAgent(BaseAgent):
    name = "shelter_agent"

    def run(self, incident_id: str) -> Dict[str, Any]:
        incident_location = None
        shelter = None
        try:
            incident_location = get_incident_coordinates(incident_id)
            if incident_location:
                shelter = find_nearest_shelter(*incident_location)
        except Exception as exc:
            logger.info("Could not load shelter details (%s)", type(exc).__name__)

        lat, lon = incident_location if incident_location else (None, None)
        if not shelter:
            return {
                "nearest_shelter_id": None,
                "shelter_name": None,
                "capacity_pct": None,
                "status": "unknown",
                "has_electricity": None,
                "has_medical": None,
                "current_occupancy": None,
                "_debug_location_used": {"lat": lat, "lon": lon},
            }

        capacity_pct = (
            round(shelter.current_occupancy * 100 / shelter.capacity)
            if shelter.capacity > 0
            else 0
        )
        if capacity_pct >= 90:
            status = "critical"
        elif capacity_pct >= 70:
            status = "near_full"
        else:
            status = "available"

        return {
            "nearest_shelter_id": shelter.id,
            "shelter_name": shelter.name,
            "capacity_pct": capacity_pct,
            "status": status,
            "has_electricity": shelter.has_electricity,
            "has_medical": shelter.has_medical,
            "current_occupancy": shelter.current_occupancy,
            "_debug_location_used": {"lat": lat, "lon": lon},
        }
