"""
CrewAI-style crew entrypoint (MOCK).

In the real implementation this will wire agents into a CrewAI Crew object
with proper Tasks.  For now it's a thin wrapper around the commander so the
API layer has a stable import path that won't change once CrewAI is wired in.
"""

from typing import Any, Dict

from app.agents.commander import generate_response_plan


def kickoff(incident_id: str) -> Dict[str, Any]:
    """Run the full agent crew pipeline for an incident.

    This is the single entrypoint the API layer should call.

    Args:
        incident_id: UUID string of the incident.

    Returns:
        Response-plan dict produced by the commander.
    """
    # TODO: replace with real CrewAI Crew(agents=[...], tasks=[...]).kickoff()
    return generate_response_plan(incident_id)
