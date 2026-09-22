"""
Road-status agent (MOCK).

Will eventually query map / routing APIs to find blocked road segments.
For now returns hardcoded output.
"""

from typing import Any, Dict

from app.agents.base import BaseAgent


class RoadAgent(BaseAgent):
    name = "road_agent"

    def run(self, incident_id: str) -> Dict[str, Any]:
        # TODO: replace with real routing / map analysis
        return {
            "status": "partial",
            "blocked_segments": ["seg_12"],
        }
