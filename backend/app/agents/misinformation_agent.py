"""
Misinformation-detection agent (MOCK).

Will eventually run image-reuse checks, cross-referencing, and
credibility scoring on citizen reports.  For now returns hardcoded output.
"""

from typing import Any, Dict

from app.agents.base import BaseAgent


class MisinformationAgent(BaseAgent):
    name = "misinformation_agent"

    def run(self, incident_id: str) -> Dict[str, Any]:
        # TODO: replace with real verification / credibility logic
        return {
            "report_id": "mock-uuid",
            "verified": True,
            "credibility_score": 0.92,
        }
