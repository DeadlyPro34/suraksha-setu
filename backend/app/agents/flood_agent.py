"""
Flood-analysis agent (MOCK).

Will eventually ingest satellite imagery / weather-API data to estimate
flood extent and severity.  For now returns hardcoded output so the
pipeline wiring can be validated end-to-end.
"""

from typing import Any, Dict

from app.agents.base import BaseAgent


class FloodAgent(BaseAgent):
    name = "flood_agent"

    def run(self, incident_id: str) -> Dict[str, Any]:
        # TODO: replace with real satellite / weather analysis
        return {
            "severity": "high",
            "flooded_pct": 65,
        }
