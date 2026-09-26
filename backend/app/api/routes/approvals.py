import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.approval import ApprovalCreate, ApprovalOut
from app.models.approval import Approval, ApprovalDecision
from app.models.response_plan import ResponsePlan, PlanStatus
from app.models.user import User
from app.services.notifications.action_service import trigger_action

router = APIRouter(prefix="/api/response-plans", tags=["approvals"])

# A mock user UUID for now
MOCK_USER_ID = "00000000-0000-0000-0000-000000000001"
MOCK_USER_PHONE = "0000000000"

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

    # Ensure mock user exists to prevent FK violation
    user = db.query(User).filter(User.phone == MOCK_USER_PHONE).first()
    if not user:
        user = db.query(User).filter(User.id == MOCK_USER_ID).first()
    if not user:
        user = User(
            id=uuid.UUID(MOCK_USER_ID),
            name="Mock Approver",
            phone=MOCK_USER_PHONE,
            email="mock@example.com",
            password_hash="mock",
            role="official",
        )
        db.add(user)
        db.flush()

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
        approval.decided_at = datetime.utcnow()
    else:
        approval = Approval(
            id=uuid.uuid4(),
            response_plan_id=plan_id,
            approved_by=user.id,
            decision=ApprovalDecision(data.decision),
            notes=data.notes,
            modified_summary=modified_summary or None,
            decided_at=datetime.utcnow(),
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
