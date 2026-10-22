"""Stable entrypoint for the custom multi-agent response workflow.

Domain agents run in a deterministic Python sequence. Their structured findings
are coordinated by the LangChain/Groq Commander; this module is not CrewAI.
"""

from typing import Any, Dict

from app.agents.commander import generate_response_plan


def kickoff(incident_id: str) -> Dict[str, Any]:
    """Run the domain agents and return their coordinated response plan."""
    return generate_response_plan(incident_id)
