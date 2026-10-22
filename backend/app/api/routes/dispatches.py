"""Official dispatch assignment and field-officer assignment actions."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.dispatch import Dispatch, DispatchStatus, DispatchTargetRole
from app.models.response_plan import PlanStatus, ResponsePlan
from app.models.user import User, UserRole
from app.schemas.approval import (
    DispatchAssignmentIn,
    DispatchAssignmentOut,
    DispatchStatusIn,
    FieldOfficerOut,
    VolunteerCompletionIn,
    VolunteerOut,
    VolunteerTaskCreate,
)


router = APIRouter(prefix="/api/dispatches", tags=["dispatches"])


def _dispatch_out(dispatch: Dispatch, volunteers_assigned: int = 1) -> DispatchAssignmentOut:
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
        target_role=dispatch.target_role.value,
        task_group_id=dispatch.task_group_id,
        volunteers_needed=dispatch.volunteers_needed,
        volunteers_assigned=volunteers_assigned,
        completion_note=dispatch.completion_note,
        completed_at=dispatch.completed_at,
    )


def _assigned_volunteer_count(db: Session, dispatch: Dispatch) -> int:
    if dispatch.task_group_id is None:
        return int(dispatch.assigned_to is not None)
    return (
        db.query(Dispatch)
        .filter(
            Dispatch.task_group_id == dispatch.task_group_id,
            Dispatch.assigned_to.is_not(None),
        )
        .count()
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


@router.get("/volunteers", response_model=list[VolunteerOut])
def list_volunteers(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    volunteers = (
        db.query(User)
        .filter(User.role == UserRole.volunteer)
        .order_by(User.name.asc(), User.id.asc())
        .all()
    )
    return [VolunteerOut(id=person.id, name=person.name, phone=person.phone) for person in volunteers]


@router.get("/volunteer-tasks", response_model=list[DispatchAssignmentOut])
def list_volunteer_tasks(
    limit: int = Query(default=500, ge=1, le=1000),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    tasks = (
        db.query(Dispatch)
        .options(
            joinedload(Dispatch.assignee),
            joinedload(Dispatch.response_plan).joinedload(ResponsePlan.incident),
        )
        .filter(Dispatch.target_role == DispatchTargetRole.volunteer)
        .order_by(Dispatch.dispatched_at.desc().nullslast(), Dispatch.id.desc())
        .limit(limit)
        .all()
    )
    return [_dispatch_out(task, _assigned_volunteer_count(db, task)) for task in tasks]


@router.post("/volunteer-tasks", response_model=list[DispatchAssignmentOut], status_code=201)
def create_volunteer_task(
    data: VolunteerTaskCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    plan = db.query(ResponsePlan).filter(ResponsePlan.id == data.response_plan_id).first()
    if plan is None:
        raise HTTPException(status_code=404, detail="Response plan not found")
    if plan.status not in {PlanStatus.approved, PlanStatus.modified}:
        raise HTTPException(status_code=409, detail="Approve the response plan before creating volunteer tasks")

    task_group_id = uuid4()
    now = datetime.now(timezone.utc)
    slots = [
        Dispatch(
            response_plan_id=plan.id,
            target_role=DispatchTargetRole.volunteer,
            task_group_id=task_group_id,
            volunteers_needed=data.volunteers_needed,
            message=data.message.strip(),
            status=DispatchStatus.sent,
            dispatched_at=now,
        )
        for _ in range(data.volunteers_needed)
    ]
    db.add_all(slots)
    db.commit()
    for slot in slots:
        db.refresh(slot)
    return [_dispatch_out(slot, 0) for slot in slots]


@router.patch("/{dispatch_id}/assign-volunteer", response_model=DispatchAssignmentOut)
def assign_volunteer(
    dispatch_id: UUID,
    data: DispatchAssignmentIn,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).with_for_update().first()
    if dispatch is None:
        raise HTTPException(status_code=404, detail="Volunteer task slot not found")
    if dispatch.target_role != DispatchTargetRole.volunteer:
        raise HTTPException(status_code=409, detail="Dispatch is not a volunteer task")
    if dispatch.assigned_to is not None:
        raise HTTPException(status_code=409, detail="This volunteer slot is already assigned")
    volunteer = (
        db.query(User)
        .filter(User.id == data.user_id, User.role == UserRole.volunteer)
        .with_for_update()
        .first()
    )
    if volunteer is None:
        raise HTTPException(status_code=404, detail="Volunteer account not found")
    if dispatch.task_group_id and db.query(Dispatch).filter(
        Dispatch.task_group_id == dispatch.task_group_id,
        Dispatch.assigned_to == volunteer.id,
    ).first():
        raise HTTPException(status_code=409, detail="This volunteer is already assigned to the task")
    dispatch.assigned_to = volunteer.id
    db.commit()
    db.refresh(dispatch)
    return _dispatch_out(dispatch, _assigned_volunteer_count(db, dispatch))


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
    return [
        _dispatch_out(dispatch, _assigned_volunteer_count(db, dispatch))
        if dispatch.target_role == DispatchTargetRole.volunteer
        else _dispatch_out(dispatch)
        for dispatch in dispatches
    ]


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
    if dispatch.status == DispatchStatus.completed:
        raise HTTPException(status_code=409, detail="Completed assignments cannot be reopened")
    dispatch.status = DispatchStatus(data.status)
    db.commit()
    db.refresh(dispatch)
    return _dispatch_out(
        dispatch,
        _assigned_volunteer_count(db, dispatch)
        if dispatch.target_role == DispatchTargetRole.volunteer
        else 1,
    )


@router.patch("/mine/{dispatch_id}/complete", response_model=DispatchAssignmentOut)
def complete_volunteer_task(
    dispatch_id: UUID,
    data: VolunteerCompletionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer")),
):
    dispatch = (
        db.query(Dispatch)
        .filter(Dispatch.id == dispatch_id, Dispatch.assigned_to == current_user.id)
        .with_for_update()
        .first()
    )
    if dispatch is None:
        raise HTTPException(status_code=404, detail="Volunteer assignment not found")
    if dispatch.target_role != DispatchTargetRole.volunteer:
        raise HTTPException(status_code=409, detail="Only volunteer tasks can be completed here")
    if dispatch.status == DispatchStatus.completed:
        raise HTTPException(status_code=409, detail="This volunteer task is already complete")
    if dispatch.status != DispatchStatus.acknowledged:
        raise HTTPException(status_code=409, detail="Acknowledge this task before reporting completion")
    note = data.completion_note.strip()
    if not note:
        raise HTTPException(status_code=422, detail="Add a note describing the completed work")
    dispatch.completion_note = note
    dispatch.completed_at = datetime.now(timezone.utc)
    dispatch.status = DispatchStatus.completed
    db.commit()
    db.refresh(dispatch)
    return _dispatch_out(dispatch, _assigned_volunteer_count(db, dispatch))
