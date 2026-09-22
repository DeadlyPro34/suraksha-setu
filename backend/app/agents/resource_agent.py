"""
Resource-allocation agent (MOCK).

Will eventually assess available resources against incident needs.
For now returns hardcoded output.
"""

from typing import Any, Dict

from app.agents.base import BaseAgent


class ResourceAgent(BaseAgent):
    name = "resource_agent"

    def run(self, incident_id: str) -> Dict[str, Any]:
        # TODO: replace with real resource availability analysis
        return {
            "medical_units_needed": 3,
            "food_days_remaining": 2,
        }
