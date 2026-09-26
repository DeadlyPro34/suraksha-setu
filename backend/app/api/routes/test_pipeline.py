# TEMP — remove once real incident flow exists
"""
Temporary test route for verifying the agent pipeline works end-to-end.

POST /api/test/run-pipeline/{incident_id}
Returns mock output from all five agents combined by the commander.
Agent findings remain mocked; the commander uses Groq when configured.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.db.session import get_db
from app.agents.crew import kickoff
from app.models.response_plan import ResponsePlan, PlanStatus
from app.models.incident import Incident, IncidentSeverity, IncidentStatus

router = APIRouter(prefix="/api/test", tags=["test-pipeline"])


@router.post("/run-pipeline/{incident_id}")
def run_pipeline(incident_id: str, db: Session = Depends(get_db)):
    """Execute the mock agent pipeline and return the response plan.

    Args:
        incident_id: Any UUID-shaped string.
        db: Database session.

    Returns:
        JSON body with the persisted plan details.
    """
    # Run the mocked-agent pipeline and Groq-backed commander.
    raw_plan = kickoff(incident_id)

    incident_uuid = uuid.UUID(incident_id)
    
    # Ensure a mock incident exists to satisfy foreign key constraints
    incident = db.query(Incident).filter(Incident.id == incident_uuid).first()
    if not incident:
        incident = Incident(
            id=incident_uuid,
            location="SRID=4326;POINT(0 0)",
            severity=IncidentSeverity.medium,
            status=IncidentStatus.open,
            start_time=datetime.utcnow(),
        )
        db.add(incident)
        db.commit()

    # Save minimal persistence step
    plan = ResponsePlan(
        id=uuid.uuid4(),
        incident_id=incident_uuid,
        priority_score=raw_plan["priority_score"],
        summary=raw_plan["summary"],
        status=PlanStatus.pending_approval,
        generated_at=datetime.utcnow()
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    # Return raw agent outputs along with db id and status
    return {
        "id": str(plan.id),
        "incident_id": str(plan.incident_id),
        "priority_score": plan.priority_score,
        "summary": plan.summary,
        "status": plan.status.value,
        "raw_agent_outputs": raw_plan["raw_agent_outputs"]
    }
