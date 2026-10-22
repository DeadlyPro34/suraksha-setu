"""Authenticated pipeline route for verifying the agent pipeline.

POST /api/test/run-pipeline/{incident_id}
Requires an official bearer token.
"""

from fastapi import APIRouter, Depends, HTTPException
import logging
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
from app.services.verification.verification_service import persist_verification

router = APIRouter(prefix="/api/test", tags=["test-pipeline"])
logger = logging.getLogger(__name__)


@router.post("/run-pipeline/{incident_id}")
def run_pipeline(
    incident_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    """Execute the mock agent pipeline and return the response plan.

    Args:
        incident_id: An incident UUID or its source report UUID.
        db: Database session.

    Returns:
        JSON body with the persisted plan details.
    """
    # Resolve either accepted identifier to a real incident before running
    # agents. Missing IDs must not create placeholder incidents at (0, 0).
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None:
        report = db.query(Report).filter(Report.id == incident_id).first()
        if report is None:
            raise HTTPException(status_code=404, detail="Incident or report not found")
        incident = report.incident
        if incident is None:
            incident = Incident(
                report_id=report.id,
                location=report.location,
                severity=IncidentSeverity.medium,
                status=IncidentStatus.open,
                start_time=report.created_at or datetime.now(timezone.utc),
            )
            db.add(incident)
            db.commit()
            db.refresh(incident)

    pending_plan = (
        db.query(ResponsePlan)
        .filter(
            ResponsePlan.incident_id == incident.id,
            ResponsePlan.status == PlanStatus.pending_approval,
        )
        .order_by(ResponsePlan.generated_at.desc(), ResponsePlan.id.desc())
        .first()
    )
    if pending_plan:
        return {
            "id": str(pending_plan.id),
            "incident_id": str(pending_plan.incident_id),
            "priority_score": pending_plan.priority_score,
            "summary": pending_plan.summary,
            "status": pending_plan.status.value,
            "raw_agent_outputs": {},
        }

    raw_plan = kickoff(str(incident.id))

    misinformation_output = raw_plan.get("raw_agent_outputs", {}).get(
        "misinformation_agent", {}
    )

    # Save minimal persistence step
    plan = ResponsePlan(
        id=uuid.uuid4(),
        incident_id=incident.id,
        priority_score=raw_plan["priority_score"],
        summary=raw_plan["summary"],
        status=PlanStatus.pending_approval,
        generated_at=datetime.now(timezone.utc)
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    if (
        incident.report_id
        and misinformation_output.get("report_id") == str(incident.report_id)
    ):
        try:
            persist_verification(db, incident.report_id, misinformation_output)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(
                "Could not persist report verification (%s)", type(exc).__name__
            )

    # Return raw agent outputs along with db id and status
    return {
        "id": str(plan.id),
        "incident_id": str(plan.incident_id),
        "priority_score": plan.priority_score,
        "summary": plan.summary,
        "status": plan.status.value,
        "raw_agent_outputs": raw_plan["raw_agent_outputs"]
    }
