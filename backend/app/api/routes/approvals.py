import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.approval import ApprovalCreate, ApprovalOut
from app.models.approval import Approval, ApprovalDecision
from app.models.response_plan import ResponsePlan, PlanStatus
from app.models.user import User, UserRole
from app.services.notifications.action_service import trigger_action

router = APIRouter(prefix="/api/response-plans", tags=["approvals"])

MOCK_USER_PHONE = "0000000000"


def _get_or_create_mock_user(db: Session) -> User:
    """Return the deterministic mock official used until auth is wired in."""
    user = db.query(User).filter(User.phone == MOCK_USER_PHONE).first()
    if user is not None:
        return user

    user = User(
        name="Mock Official",
        phone=MOCK_USER_PHONE,
        role=UserRole.official,
        password_hash="mock-only-no-login",
    )
    db.add(user)
    db.flush()
    return user

@router.post("/{plan_id}/decision", response_model=ApprovalOut)
def submit_decision(plan_id: uuid.UUID, data: ApprovalCreate, db: Session = Depends(get_db)):
    # Serialize decisions for one plan so concurrent approval retries cannot
    # create multiple simulated action batches.
    plan = (
        db.query(ResponsePlan)
        .filter(ResponsePlan.id == plan_id)
        .with_for_update()
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="ResponsePlan not found")

    modified_summary = (data.modified_summary or "").strip()
    if data.decision == "modified" and not modified_summary:
        raise HTTPException(
            status_code=422,
            detail="modified_summary is required for a modified decision",
        )

    # TODO: Remove when auth is implemented
    user = _get_or_create_mock_user(db)

    approval = (
        db.query(Approval)
        .filter(Approval.response_plan_id == plan_id)
        .first()
    )
    if approval:
        approval.approved_by = user.id
        approval.decision = ApprovalDecision(data.decision)
        approval.notes = data.notes
        approval.modified_summary = modified_summary or None
        approval.decided_at = datetime.now(timezone.utc)
    else:
        approval = Approval(
            id=uuid.uuid4(),
            response_plan_id=plan_id,
            approved_by=user.id,
            decision=ApprovalDecision(data.decision),
            notes=data.notes,
            modified_summary=modified_summary or None,
            decided_at=datetime.now(timezone.utc),
        )
        db.add(approval)

    # Approval, plan status, and first action batch commit atomically.
    plan.status = PlanStatus(data.decision)
    action_result = (
        trigger_action(str(plan.id), db) if data.decision == "approved" else None
    )
    db.commit()
    db.refresh(approval)

    return {
        **ApprovalOut.model_validate(approval).model_dump(),
        "action_result": action_result,
    }


@router.get("/{plan_id}/decision", response_model=ApprovalOut)
def get_decision(plan_id: uuid.UUID, db: Session = Depends(get_db)):
    approval = db.query(Approval).filter(Approval.response_plan_id == plan_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Decision not found")
    return approval
