"""Official dispatch assignment and field-officer assignment actions."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.dispatch import Dispatch, DispatchStatus, DispatchTargetRole
from app.models.response_plan import ResponsePlan
from app.models.user import User, UserRole
from app.schemas.approval import (
    DispatchAssignmentIn,
    DispatchAssignmentOut,
    DispatchStatusIn,
    FieldOfficerOut,
)


router = APIRouter(prefix="/api/dispatches", tags=["dispatches"])


def _dispatch_out(dispatch: Dispatch) -> DispatchAssignmentOut:
    plan = dispatch.response_plan
    incident = plan.incident if plan else None
    return DispatchAssignmentOut(
        id=dispatch.id,
        response_plan_id=dispatch.response_plan_id,
        incident_id=incident.id if incident else None,
        report_id=incident.report_id if incident else None,
        assignee_id=dispatch.assigned_to,
        assignee_name=dispatch.assignee.name if dispatch.assignee else None,
        message=dispatch.message,
        status=dispatch.status.value,
        dispatched_at=dispatch.dispatched_at,
    )


@router.get("/field-officers", response_model=list[FieldOfficerOut])
def list_field_officers(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    officers = (
        db.query(User)
        .filter(User.role == UserRole.field_officer)
        .order_by(User.name.asc(), User.id.asc())
        .all()
    )
    return [FieldOfficerOut(id=officer.id, name=officer.name) for officer in officers]


@router.get("/unassigned", response_model=list[DispatchAssignmentOut])
def list_unassigned_dispatches(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    dispatches = (
        db.query(Dispatch)
        .options(joinedload(Dispatch.response_plan).joinedload(ResponsePlan.incident))
        .filter(
            Dispatch.target_role == DispatchTargetRole.field_officer,
            Dispatch.assigned_to.is_(None),
        )
        .order_by(Dispatch.dispatched_at.desc().nullslast(), Dispatch.id.desc())
        .limit(limit)
        .all()
    )
    return [_dispatch_out(dispatch) for dispatch in dispatches]


@router.patch("/{dispatch_id}/assign", response_model=DispatchAssignmentOut)
def assign_dispatch(
    dispatch_id: UUID,
    data: DispatchAssignmentIn,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    dispatch = (
        db.query(Dispatch)
        .filter(Dispatch.id == dispatch_id)
        .with_for_update()
        .first()
    )
    if dispatch is None:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    if dispatch.target_role != DispatchTargetRole.field_officer:
        raise HTTPException(status_code=409, detail="Dispatch is not for field officers")

    officer = (
        db.query(User)
        .filter(User.id == data.user_id, User.role == UserRole.field_officer)
        .first()
    )
    if officer is None:
        raise HTTPException(status_code=404, detail="Field officer not found")

    dispatch.assigned_to = officer.id
    db.commit()
    db.refresh(dispatch)
    return _dispatch_out(dispatch)


@router.get("/mine", response_model=list[DispatchAssignmentOut])
def list_my_dispatches(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("field_officer", "volunteer")),
):
    dispatches = (
        db.query(Dispatch)
        .options(
            joinedload(Dispatch.assignee),
            joinedload(Dispatch.response_plan).joinedload(ResponsePlan.incident),
        )
        .filter(Dispatch.assigned_to == current_user.id)
        .order_by(Dispatch.dispatched_at.desc().nullslast(), Dispatch.id.desc())
        .all()
    )
    return [_dispatch_out(dispatch) for dispatch in dispatches]


@router.patch("/mine/{dispatch_id}/status", response_model=DispatchAssignmentOut)
def acknowledge_dispatch(
    dispatch_id: UUID,
    data: DispatchStatusIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("field_officer", "volunteer")),
):
    dispatch = (
        db.query(Dispatch)
        .filter(Dispatch.id == dispatch_id, Dispatch.assigned_to == current_user.id)
        .with_for_update()
        .first()
    )
    if dispatch is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    dispatch.status = DispatchStatus(data.status)
    db.commit()
    db.refresh(dispatch)
    return _dispatch_out(dispatch)
