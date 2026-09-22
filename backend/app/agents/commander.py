"""
Commander — orchestrates all domain agents and builds a response plan.

Calls the five domain agents, merges their outputs, computes a simple
priority score, and returns a dict shaped like the ResponsePlan model.
"""

from typing import Any, Dict

from app.agents.flood_agent import FloodAgent
from app.agents.road_agent import RoadAgent
from app.agents.shelter_agent import ShelterAgent
from app.agents.resource_agent import ResourceAgent
from app.agents.misinformation_agent import MisinformationAgent


# Pre-instantiate agents (stateless, safe to reuse)
_agents = [
    FloodAgent(),
    RoadAgent(),
    ShelterAgent(),
    ResourceAgent(),
    MisinformationAgent(),
]


def _compute_priority_score(agent_outputs: Dict[str, Any]) -> float:
    """Derive a 0-10 priority score from agent outputs.

    This is a placeholder formula.  It will be replaced with a proper
    weighted model once the real agent logic is in place.
    """
    flood = agent_outputs.get("flood_agent", {})
    resource = agent_outputs.get("resource_agent", {})

    severity_map = {"low": 2.0, "medium": 5.0, "high": 8.0, "critical": 10.0}
    base = severity_map.get(flood.get("severity", "medium"), 5.0)

    # Bump priority if food supplies are running low
    food_days = resource.get("food_days_remaining", 7)
    urgency_bump = max(0.0, (3 - food_days) * 0.5)

    return round(min(base + urgency_bump, 10.0), 2)


def generate_response_plan(incident_id: str) -> Dict[str, Any]:
    """Run every agent and combine results into a response-plan dict.

    Args:
        incident_id: UUID string of the incident.

    Returns:
        Dict shaped like the ResponsePlan model with:
        - priority_score (float)
        - summary (str)
        - raw_agent_outputs (dict keyed by agent name)
    """
    raw_outputs: Dict[str, Any] = {}
    for agent in _agents:
        raw_outputs[agent.name] = agent.run(incident_id)

    priority = _compute_priority_score(raw_outputs)

    summary = (
        f"Auto-generated response plan for incident {incident_id}. "
        f"Flood severity: {raw_outputs['flood_agent']['severity']}. "
        f"Road status: {raw_outputs['road_agent']['status']}. "
        f"Nearest shelter capacity: {raw_outputs['shelter_agent']['capacity_pct']}%. "
        f"Medical units needed: {raw_outputs['resource_agent']['medical_units_needed']}. "
        f"Report credibility: {raw_outputs['misinformation_agent']['credibility_score']}."
    )

    return {
        "incident_id": incident_id,
        "priority_score": priority,
        "summary": summary,
        "raw_agent_outputs": raw_outputs,
    }
