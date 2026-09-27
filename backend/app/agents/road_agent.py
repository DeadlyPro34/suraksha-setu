"""Route from an incident to its nearest open shelter."""

import logging
from typing import Any, Dict, Optional

from app.agents.base import BaseAgent
from app.services.ingestion.routing_service import get_route
from app.services.shelter_lookup import (
    find_nearest_shelter,
    get_incident_coordinates,
)


logger = logging.getLogger(__name__)


class RoadAgent(BaseAgent):
    name = "road_agent"

    def run(
        self, incident_id: str, flood_severity: Optional[str] = None
    ) -> Dict[str, Any]:
        incident_location = None
        shelter = None
        try:
            incident_location = get_incident_coordinates(incident_id)
            if incident_location:
                shelter = find_nearest_shelter(*incident_location)
        except Exception as exc:
            logger.info("Could not load route endpoints (%s)", type(exc).__name__)

        route = {"distance_km": None, "duration_min": None, "route_found": False}
        if incident_location and shelter:
            route = get_route(
                incident_location[0],
                incident_location[1],
                shelter.latitude,
                shelter.longitude,
            )

        if not route["route_found"]:
            status = "unknown"
        elif flood_severity in ("critical", "high"):
            # OSRM has no live flood blockage feed, so severe flood conditions
            # mean a mapped route should be treated as potentially degraded.
            status = "partial"
        else:
            status = "clear"

        # Segment-level flood blockage detection is future scope; preserve the
        # response key now so consumers can keep the same output contract.
        lat, lon = incident_location if incident_location else (None, None)
        return {
            "status": status,
            "distance_km": route["distance_km"],
            "duration_min": route["duration_min"],
            "nearest_shelter_id": shelter.id if shelter else None,
            "blocked_segments": [],
            "_debug_location_used": {"lat": lat, "lon": lon},
        }
