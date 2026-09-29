"""Authenticated pipeline route for verifying the agent pipeline.

POST /api/test/run-pipeline/{incident_id}
Requires an official bearer token.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import uuid

from app.db.session import get_db
from app.core.dependencies import require_role
from app.models.user import User
from app.agents.crew import kickoff
from app.models.response_plan import ResponsePlan, PlanStatus
from app.models.incident import Incident, IncidentSeverity, IncidentStatus
from app.models.report import Report

router = APIRouter(prefix="/api/test", tags=["test-pipeline"])


@router.post("/run-pipeline/{incident_id}")
def run_pipeline(
    incident_id: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
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
    
    # Reuse the report's real location when this pipeline is launched from a
    # report ID. This prevents simulated dispatches from targeting (0, 0).
    report = db.query(Report).filter(Report.id == incident_uuid).first()
    incident = db.query(Incident).filter(Incident.id == incident_uuid).first()
    if not incident:
        incident = Incident(
            id=incident_uuid,
            report_id=report.id if report else None,
            location=report.location if report else "SRID=4326;POINT(0 0)",
            severity=IncidentSeverity.medium,
            status=IncidentStatus.open,
            start_time=datetime.now(timezone.utc),
        )
        db.add(incident)
        db.commit()
    elif report and incident.report_id in (None, report.id):
        # Repair placeholder incidents created by earlier test-pipeline runs.
        incident.report_id = report.id
        incident.location = report.location

    # Save minimal persistence step
    plan = ResponsePlan(
        id=uuid.uuid4(),
        incident_id=incident_uuid,
        priority_score=raw_plan["priority_score"],
        summary=raw_plan["summary"],
        status=PlanStatus.pending_approval,
        generated_at=datetime.now(timezone.utc)
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
