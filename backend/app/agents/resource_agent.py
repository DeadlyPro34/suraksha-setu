"""Summarize available regional resources against shelter occupancy."""

import logging
from typing import Any, Dict, Optional

from app.agents.base import BaseAgent
from app.db.session import SessionLocal
from app.models.resource import Resource, ResourceStatus, ResourceType
from app.services.shelter_lookup import (
    find_nearest_shelter,
    get_incident_coordinates,
)


logger = logging.getLogger(__name__)


class ResourceAgent(BaseAgent):
    name = "resource_agent"

    def run(
        self,
        incident_id: str,
        shelter_output: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        coordinates = None
        try:
            coordinates = get_incident_coordinates(incident_id)
        except Exception as exc:
            logger.info("Could not load resource incident coordinates (%s)", type(exc).__name__)

        occupancy = (shelter_output or {}).get("current_occupancy")
        if occupancy is None and coordinates:
            try:
                nearest_shelter = find_nearest_shelter(*coordinates)
                occupancy = nearest_shelter.current_occupancy if nearest_shelter else 0
            except Exception as exc:
                logger.info("Could not load shelter occupancy for resources (%s)", type(exc).__name__)
                occupancy = 0
        occupancy = max(0, int(occupancy or 0))

        available_resources = []
        try:
            with SessionLocal() as db:
                resources = (
                    db.query(Resource)
                    .filter(Resource.status == ResourceStatus.available)
                    .all()
                )
                available_resources = [
                    {
                        "type": resource.type.value,
                        "quantity": resource.quantity,
                        "status": resource.status.value,
                    }
                    for resource in resources
                ]
        except Exception as exc:
            logger.info("Could not load available resources (%s)", type(exc).__name__)

        quantities: Dict[str, int] = {}
        for resource in available_resources:
            resource_type = resource["type"]
            quantities[resource_type] = quantities.get(resource_type, 0) + resource["quantity"]

        medical_available = quantities.get(ResourceType.medical.value, 0)
        medical_needed = min(round(occupancy / 50), medical_available)
        food_person_days = quantities.get(ResourceType.food.value, 0)
        # If occupancy is zero or unavailable, use one person to avoid division
        # by zero while preserving the stock's person-day interpretation.
        food_days_remaining = round(food_person_days / max(occupancy, 1), 2)
        lat, lon = coordinates if coordinates else (None, None)

        return {
            "medical_units_needed": medical_needed,
            "food_days_remaining": food_days_remaining,
            "available_resources": available_resources,
            "_debug_location_used": {"lat": lat, "lon": lon},
        }
