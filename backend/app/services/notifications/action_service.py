"""Create simulated citizen alerts and field-team dispatch instructions."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session

from app.models.alert import Alert, AlertType
from app.models.dispatch import Dispatch, DispatchStatus, DispatchTargetRole
from app.models.incident import IncidentSeverity
from app.models.response_plan import ResponsePlan

logger = logging.getLogger(__name__)


def trigger_action(response_plan_id: str, db: Session) -> dict[str, int]:
    """Persist one simulated citizen alert and one field-team dispatch.

    Existing dispatch rows are the idempotency marker for this action batch.
    Repeated approvals therefore return zero new actions instead of sending
    duplicate alerts or instructions. If the earlier transaction failed,
    there is no marker and a retry can create the batch.
    """
    plan = (
        db.query(ResponsePlan)
        .filter(ResponsePlan.id == UUID(response_plan_id))
        .first()
    )
    if plan is None:
        raise ValueError(f"Response plan {response_plan_id} was not found")

    incident = plan.incident
    if incident is None:
        raise ValueError(f"Response plan {response_plan_id} has no incident")

    if db.query(Dispatch.id).filter(Dispatch.response_plan_id == plan.id).first():
        logger.info(
            "Action batch already exists for response plan %s; skipping duplicate send",
            plan.id,
        )
        return {"alerts_created": 0, "dispatches_created": 0}

    severity = getattr(incident.severity, "value", incident.severity)
    alert_type = (
        AlertType.evacuation
        if severity in {IncidentSeverity.high.value, IncidentSeverity.critical.value}
        else AlertType.warning
    )
    alert_prefix = "Evacuation notice" if alert_type == AlertType.evacuation else "Safety warning"
    alert_message = f"{alert_prefix}: {plan.summary}"

    try:
        point = to_shape(incident.location)
        location = f"{point.y:.5f}, {point.x:.5f}"
    except (AttributeError, TypeError, ValueError):
        location = "the reported incident location"

    now = datetime.now(timezone.utc)
    alert = Alert(
        incident_id=incident.id,
        type=alert_type,
        message=alert_message,
        # Multilingual alert generation is future scope for the Communication Agent.
        language="en",
        sent_at=now,
    )
    dispatch = Dispatch(
        response_plan_id=plan.id,
        target_role=DispatchTargetRole.field_officer,
        message=f"Respond to {location} — priority {plan.priority_score}: {plan.summary}",
        status=DispatchStatus.sent,
        dispatched_at=now,
    )

    db.add_all([alert, dispatch])
    db.flush()
    logger.info(
        "Simulated action for response plan %s: citizen alert and field-officer dispatch recorded; "
        "a production integration would call SMS/push providers here",
        plan.id,
    )
    return {"alerts_created": 1, "dispatches_created": 1}
