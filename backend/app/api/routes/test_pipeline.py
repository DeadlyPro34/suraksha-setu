# TEMP — remove once real incident flow exists
"""
Temporary test route for verifying the agent pipeline works end-to-end.

POST /api/test/run-pipeline/{incident_id}
Returns mock output from all five agents combined by the commander.
No database access, no LLM calls — pure pipeline wiring validation.
"""

from fastapi import APIRouter

from app.agents.crew import kickoff

router = APIRouter(prefix="/api/test", tags=["test-pipeline"])


@router.post("/run-pipeline/{incident_id}")
def run_pipeline(incident_id: str):
    """Execute the mock agent pipeline and return the response plan.

    Args:
        incident_id: Any UUID-shaped string (not validated against DB).

    Returns:
        JSON body with priority_score, summary, and raw_agent_outputs.
    """
    # TEMP — remove once real incident flow exists
    return kickoff(incident_id)
