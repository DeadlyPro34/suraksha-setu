"""Read simulated citizen alerts and dispatches for a response plan."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.alert import Alert
from app.models.dispatch import Dispatch
from app.models.response_plan import ResponsePlan

router = APIRouter(prefix="/api/response-plans", tags=["actions"])


@router.get("/{plan_id}/actions")
def get_plan_actions(plan_id: UUID, db: Session = Depends(get_db)):
    plan = db.query(ResponsePlan).filter(ResponsePlan.id == plan_id).first()
    if plan is None:
        raise HTTPException(status_code=404, detail="ResponsePlan not found")

    alerts = (
        db.query(Alert)
        .filter(Alert.incident_id == plan.incident_id)
        .order_by(Alert.sent_at.desc().nullslast(), Alert.id)
        .all()
    )
    dispatches = (
        db.query(Dispatch)
        .filter(Dispatch.response_plan_id == plan.id)
        .order_by(Dispatch.dispatched_at.desc().nullslast(), Dispatch.id)
        .all()
    )

    return {
        "alerts": [
            {
                "id": str(alert.id),
                "incident_id": str(alert.incident_id),
                "type": alert.type.value,
                "message": alert.message,
                "language": alert.language,
                "sent_at": alert.sent_at,
            }
            for alert in alerts
        ],
        "dispatches": [
            {
                "id": str(dispatch.id),
                "response_plan_id": str(dispatch.response_plan_id),
                "target_role": dispatch.target_role.value,
                "message": dispatch.message,
                "status": dispatch.status.value,
                "dispatched_at": dispatch.dispatched_at,
            }
            for dispatch in dispatches
        ],
    }
