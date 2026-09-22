"""
Shelter-finder agent (MOCK).

Will eventually query the shelters table and calculate proximity.
For now returns hardcoded output.
"""

from typing import Any, Dict

from app.agents.base import BaseAgent


class ShelterAgent(BaseAgent):
    name = "shelter_agent"

    def run(self, incident_id: str) -> Dict[str, Any]:
        # TODO: replace with real shelter proximity query
        return {
            "nearest_shelter_id": "mock-uuid",
            "capacity_pct": 40,
        }
