"""Official dispatch assignment and field-officer assignment actions."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.dispatch import Dispatch, DispatchStatus, DispatchTargetRole, DispatchUpdate, FieldOfficerSupportMessage, FieldOfficerSupportRequest
from app.models.response_plan import PlanStatus, ResponsePlan
from app.models.user import User, UserRole
from app.schemas.approval import (
    DispatchAssignmentIn,
    DispatchAssignmentOut,
    DispatchStatusIn,
    DispatchUpdateCreate,
    DispatchUpdateOut,
    DispatchCompletionIn,
    FieldOfficerSupportAssignmentIn,
    FieldOfficerSupportMessageCreate,
    FieldOfficerSupportMessageOut,
    FieldOfficerSupportRequestIn,
    FieldOfficerSupportRequestOut,
    FieldOfficerSupportVolunteerOut,
    FieldOfficerOut,
    VolunteerOut,
    VolunteerTaskCreate,
)


router = APIRouter(prefix="/api/dispatches", tags=["dispatches"])


def _dispatch_out(dispatch: Dispatch, volunteers_assigned: int = 1) -> DispatchAssignmentOut:
    plan = dispatch.response_plan
    incident = plan.incident if plan else None
    point = to_shape(incident.location) if incident and incident.location else None
    lat = float(point.y) if point else None
    lon = float(point.x) if point else None
    if lat == 0 and lon == 0:
        lat = lon = None
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
        completion_acknowledged_at=dispatch.completion_acknowledged_at,
        shift_starts_at=dispatch.shift_starts_at,
        shift_ends_at=dispatch.shift_ends_at,
        checked_in_at=dispatch.checked_in_at,
        checked_out_at=dispatch.checked_out_at,
        meeting_point=dispatch.meeting_point,
        instructions=dispatch.instructions,
        due_at=dispatch.due_at,
        updates=[DispatchUpdateOut(
            id=update.id, author_id=update.author_id,
            author_name=update.author.name if update.author else "Response team",
            kind=update.kind, note=update.note, media_id=update.media_id,
            remaining_work=update.remaining_work, resources_used=update.resources_used,
            created_at=update.created_at,
        ) for update in dispatch.updates],
        support_requests=[_support_request_out(request) for request in dispatch.support_requests],
        support_request_id=dispatch.support_request_id,
        support_request_messages=[_support_message_out(message) for message in dispatch.support_request.messages] if dispatch.support_request else [],
        priority_score=plan.priority_score if plan else None,
        lat=lat,
        lon=lon,
    )


def _support_request_out(request: FieldOfficerSupportRequest) -> FieldOfficerSupportRequestOut:
    return FieldOfficerSupportRequestOut(
        id=request.id,
        dispatch_id=request.dispatch_id,
        requested_by=request.requested_by,
        officer_name=request.requester.name if request.requester else "Field officer",
        support_type=request.support_type,
        details=request.details,
        location=request.location,
        volunteers_needed=request.volunteers_needed,
        volunteers_assigned=sum(1 for task in request.volunteer_dispatches if task.assigned_to is not None),
        volunteers=[FieldOfficerSupportVolunteerOut(
            dispatch_id=task.id,
            name=task.assignee.name if task.assignee else "Volunteer",
            status=task.status.value,
        ) for task in request.volunteer_dispatches if task.assigned_to is not None],
        messages=[_support_message_out(message) for message in request.messages],
        status=request.status,
        created_at=request.created_at,
    )


def _support_message_out(message: FieldOfficerSupportMessage) -> FieldOfficerSupportMessageOut:
    return FieldOfficerSupportMessageOut(
        id=message.id, author_id=message.author_id,
        author_name=message.author.name if message.author else "Team member",
        author_role=message.author.role.value if message.author and hasattr(message.author.role, "value") else str(message.author.role) if message.author else "unknown",
        message=message.message, created_at=message.created_at,
    )


def _get_support_request_for_participant(db: Session, request_id: UUID, current_user: User) -> FieldOfficerSupportRequest:
    request = db.query(FieldOfficerSupportRequest).options(
        joinedload(FieldOfficerSupportRequest.requester),
        selectinload(FieldOfficerSupportRequest.volunteer_dispatches),
        selectinload(FieldOfficerSupportRequest.messages).joinedload(FieldOfficerSupportMessage.author),
    ).filter(FieldOfficerSupportRequest.id == request_id).first()
    if request is None:
        raise HTTPException(status_code=404, detail="Volunteer support request not found")
    if current_user.role == UserRole.official or request.requested_by == current_user.id:
        return request
    if current_user.role == UserRole.volunteer and any(task.assigned_to == current_user.id for task in request.volunteer_dispatches):
        return request
    raise HTTPException(status_code=404, detail="Volunteer support request not found")


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
    return [VolunteerOut(
        id=person.id,
        name=person.name,
        phone=person.phone,
        available=person.volunteer_available,
        skills=person.volunteer_skills,
        languages=person.volunteer_languages,
        has_transport=person.volunteer_has_transport,
    ) for person in volunteers]


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
            selectinload(Dispatch.updates).joinedload(DispatchUpdate.author),
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
    if data.shift_starts_at and data.shift_ends_at and data.shift_ends_at <= data.shift_starts_at:
        raise HTTPException(status_code=422, detail="Shift end must be after shift start")

    task_group_id = uuid4()
    now = datetime.now(timezone.utc)
    slots = [
        Dispatch(
            response_plan_id=plan.id,
            target_role=DispatchTargetRole.volunteer,
            task_group_id=task_group_id,
            volunteers_needed=data.volunteers_needed,
            shift_starts_at=data.shift_starts_at,
            shift_ends_at=data.shift_ends_at,
            meeting_point=data.meeting_point.strip() if data.meeting_point else None,
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
    if not volunteer.volunteer_available:
        raise HTTPException(status_code=409, detail="This volunteer is not currently available for assignments")
    active_assignment = db.query(Dispatch).filter(
        Dispatch.assigned_to == volunteer.id,
        Dispatch.target_role == DispatchTargetRole.volunteer,
        Dispatch.status != DispatchStatus.completed,
    ).first()
    if active_assignment:
        raise HTTPException(status_code=409, detail="This volunteer already has an active assignment")
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


@router.get("/field-officer-tasks", response_model=list[DispatchAssignmentOut])
def list_field_officer_tasks(
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    dispatches = (
        db.query(Dispatch)
        .options(
            joinedload(Dispatch.assignee),
            joinedload(Dispatch.response_plan).joinedload(ResponsePlan.incident),
            selectinload(Dispatch.updates).joinedload(DispatchUpdate.author),
        )
        .filter(
            Dispatch.target_role == DispatchTargetRole.field_officer,
            Dispatch.assigned_to.is_not(None),
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
    if data.instructions is not None:
        dispatch.instructions = data.instructions.strip() or None
    if data.due_at is not None:
        if data.due_at.tzinfo is None:
            raise HTTPException(status_code=422, detail="Due date must include a timezone")
        dispatch.due_at = data.due_at
    if data.meeting_point is not None:
        dispatch.meeting_point = data.meeting_point.strip() or None
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
            selectinload(Dispatch.updates).joinedload(DispatchUpdate.author),
            selectinload(Dispatch.support_requests).joinedload(FieldOfficerSupportRequest.requester),
            selectinload(Dispatch.support_requests).selectinload(FieldOfficerSupportRequest.volunteer_dispatches).joinedload(Dispatch.assignee),
            selectinload(Dispatch.support_requests).selectinload(FieldOfficerSupportRequest.messages).joinedload(FieldOfficerSupportMessage.author),
            selectinload(Dispatch.support_request).selectinload(FieldOfficerSupportRequest.messages).joinedload(FieldOfficerSupportMessage.author),
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


@router.post("/mine/{dispatch_id}/support-requests", response_model=FieldOfficerSupportRequestOut, status_code=201)
def request_volunteer_support(
    dispatch_id: UUID,
    data: FieldOfficerSupportRequestIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("field_officer")),
):
    dispatch = db.query(Dispatch).filter(
        Dispatch.id == dispatch_id,
        Dispatch.assigned_to == current_user.id,
        Dispatch.target_role == DispatchTargetRole.field_officer,
    ).with_for_update().first()
    if dispatch is None:
        raise HTTPException(status_code=404, detail="Field assignment not found")
    if dispatch.status == DispatchStatus.completed:
        raise HTTPException(status_code=409, detail="A completed assignment cannot request volunteer support")
    open_request = db.query(FieldOfficerSupportRequest).filter(
        FieldOfficerSupportRequest.dispatch_id == dispatch.id,
        FieldOfficerSupportRequest.status.in_(["pending", "assigned"]),
    ).first()
    if open_request:
        raise HTTPException(status_code=409, detail="There is already an open volunteer support request for this assignment")
    request = FieldOfficerSupportRequest(
        dispatch_id=dispatch.id,
        requested_by=current_user.id,
        support_type=data.support_type,
        volunteers_needed=data.volunteers_needed,
        details=data.details.strip(),
        location=(data.location or "").strip() or dispatch.meeting_point or None,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return _support_request_out(request)


@router.get("/support-requests", response_model=list[FieldOfficerSupportRequestOut])
def list_volunteer_support_requests(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    requests = (
        db.query(FieldOfficerSupportRequest)
        .options(
            joinedload(FieldOfficerSupportRequest.requester),
            selectinload(FieldOfficerSupportRequest.volunteer_dispatches).joinedload(Dispatch.assignee),
            selectinload(FieldOfficerSupportRequest.messages).joinedload(FieldOfficerSupportMessage.author),
        )
        .filter(FieldOfficerSupportRequest.status.in_(["pending", "assigned"]))
        .order_by(FieldOfficerSupportRequest.created_at.desc())
        .all()
    )
    return [_support_request_out(request) for request in requests]


@router.get("/support-requests/{request_id}/messages", response_model=list[FieldOfficerSupportMessageOut])
def list_support_request_messages(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("official", "field_officer", "volunteer")),
):
    request = _get_support_request_for_participant(db, request_id, current_user)
    return [_support_message_out(message) for message in request.messages]


@router.post("/support-requests/{request_id}/messages", response_model=FieldOfficerSupportMessageOut, status_code=201)
def create_support_request_message(
    request_id: UUID,
    data: FieldOfficerSupportMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("official", "field_officer", "volunteer")),
):
    request = _get_support_request_for_participant(db, request_id, current_user)
    message = FieldOfficerSupportMessage(
        support_request_id=request.id,
        author_id=current_user.id,
        message=data.message.strip(),
    )
    if not message.message:
        raise HTTPException(status_code=422, detail="Message cannot be empty")
    db.add(message)
    db.commit()
    db.refresh(message)
    message.author = current_user
    return _support_message_out(message)


@router.post("/support-requests/{request_id}/assign", response_model=FieldOfficerSupportRequestOut)
def assign_volunteers_to_support_request(
    request_id: UUID,
    data: FieldOfficerSupportAssignmentIn,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    request = db.query(FieldOfficerSupportRequest).filter(
        FieldOfficerSupportRequest.id == request_id,
    ).with_for_update().first()
    if request is None:
        raise HTTPException(status_code=404, detail="Volunteer support request not found")
    if request.status not in {"pending", "assigned"}:
        raise HTTPException(status_code=409, detail="This support request is no longer open")
    if len(set(data.volunteer_ids)) != len(data.volunteer_ids):
        raise HTTPException(status_code=422, detail="Choose each volunteer only once")

    volunteer_tasks = db.query(Dispatch).filter(Dispatch.support_request_id == request.id).with_for_update().all()
    if not volunteer_tasks:
        officer_dispatch = db.query(Dispatch).filter(Dispatch.id == request.dispatch_id).first()
        if officer_dispatch is None:
            raise HTTPException(status_code=404, detail="Officer assignment not found")
        task_group_id = uuid4()
        msg = f"{request.support_type.title()} support for {request.requester.name if request.requester else 'field officer'}: {request.details}"
        volunteer_tasks = [Dispatch(
            response_plan_id=officer_dispatch.response_plan_id,
            target_role=DispatchTargetRole.volunteer,
            task_group_id=task_group_id,
            support_request_id=request.id,
            volunteers_needed=request.volunteers_needed,
            instructions=request.details,
            meeting_point=request.location,
            message=msg,
            status=DispatchStatus.sent,
            dispatched_at=datetime.now(timezone.utc),
        ) for _ in range(request.volunteers_needed)]
        db.add_all(volunteer_tasks)
        db.flush()

    open_slots = [task for task in volunteer_tasks if task.assigned_to is None]
    if len(data.volunteer_ids) > len(open_slots):
        raise HTTPException(status_code=409, detail="All requested volunteer slots are already assigned")
    volunteers = db.query(User).filter(
        User.id.in_(data.volunteer_ids), User.role == UserRole.volunteer,
    ).with_for_update().all()
    if len(volunteers) != len(data.volunteer_ids):
        raise HTTPException(status_code=404, detail="One or more volunteer accounts were not found")
    for volunteer in volunteers:
        if not volunteer.volunteer_available:
            raise HTTPException(status_code=409, detail=f"{volunteer.name} is not currently available")
        active = db.query(Dispatch).filter(
            Dispatch.assigned_to == volunteer.id,
            Dispatch.target_role == DispatchTargetRole.volunteer,
            Dispatch.status != DispatchStatus.completed,
        ).first()
        if active:
            raise HTTPException(status_code=409, detail=f"{volunteer.name} already has an active volunteer assignment")
    for slot, volunteer in zip(open_slots, volunteers):
        slot.assigned_to = volunteer.id
    assigned_count = sum(1 for task in volunteer_tasks if task.assigned_to is not None)
    request.status = "assigned" if assigned_count >= request.volunteers_needed else "pending"
    db.commit()
    db.expire(request, ["requester", "volunteer_dispatches"])
    return _support_request_out(request)


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
    if dispatch.target_role in {DispatchTargetRole.field_officer, DispatchTargetRole.volunteer}:
        allowed_transitions = {
            DispatchStatus.sent: {DispatchStatus.acknowledged},
            DispatchStatus.acknowledged: {DispatchStatus.en_route, DispatchStatus.needs_help},
            DispatchStatus.en_route: {DispatchStatus.arrived, DispatchStatus.needs_help},
            DispatchStatus.arrived: {DispatchStatus.needs_help},
            DispatchStatus.needs_help: {DispatchStatus.en_route, DispatchStatus.arrived},
        }
        next_status = DispatchStatus(data.status)
        if next_status not in allowed_transitions.get(dispatch.status, set()):
            raise HTTPException(status_code=409, detail="That task status update is not allowed")
        dispatch.status = next_status
        status_notes = {
            DispatchStatus.acknowledged: "Accepted the assignment.",
            DispatchStatus.en_route: "On my way to the assignment.",
            DispatchStatus.arrived: "Arrived at the assignment location.",
            DispatchStatus.needs_help: "Requested assistance from officials.",
        }
        db.add(DispatchUpdate(
            dispatch_id=dispatch.id,
            author_id=current_user.id,
            kind="status_update",
            note=status_notes[next_status],
        ))
    elif dispatch.status == DispatchStatus.completed or data.status != "acknowledged":
        raise HTTPException(status_code=409, detail="That field assignment status update is not allowed")
    else:
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
def complete_assigned_task(
    dispatch_id: UUID,
    data: DispatchCompletionIn,
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
    expected_target = DispatchTargetRole.volunteer if current_user.role == UserRole.volunteer else DispatchTargetRole.field_officer
    if dispatch.target_role != expected_target:
        raise HTTPException(status_code=409, detail="This assignment cannot be completed by this account")
    if dispatch.status == DispatchStatus.completed:
        raise HTTPException(status_code=409, detail="This assignment is already complete")
    if dispatch.status != DispatchStatus.arrived:
        raise HTTPException(status_code=409, detail="Mark that you have arrived before reporting task completion")
    note = data.completion_note.strip()
    if not note:
        raise HTTPException(status_code=422, detail="Add a note describing the completed work")
    dispatch.completion_note = note
    dispatch.completed_at = datetime.now(timezone.utc)
    dispatch.status = DispatchStatus.completed
    if dispatch.checked_in_at is not None and dispatch.checked_out_at is None:
        dispatch.checked_out_at = dispatch.completed_at
    if current_user.role == UserRole.volunteer:
        from app.models.volunteer_location import VolunteerLocation
        db.query(VolunteerLocation).filter(
            VolunteerLocation.volunteer_id == current_user.id,
            VolunteerLocation.dispatch_id == dispatch.id,
        ).delete(synchronize_session=False)
        if dispatch.support_request_id:
            remaining_support_tasks = db.query(Dispatch).filter(
                Dispatch.support_request_id == dispatch.support_request_id,
                Dispatch.id != dispatch.id,
                Dispatch.status != DispatchStatus.completed,
            ).count()
            if remaining_support_tasks == 0:
                support_request = db.query(FieldOfficerSupportRequest).filter(
                    FieldOfficerSupportRequest.id == dispatch.support_request_id,
                ).with_for_update().first()
                if support_request:
                    support_request.status = "completed"
    db.add(DispatchUpdate(
        dispatch_id=dispatch.id, author_id=current_user.id, kind="completion",
        note=note, media_id=data.media_id,
        remaining_work=(data.remaining_work or "").strip() or None,
        resources_used=(data.resources_used or "").strip() or None,
    ))
    db.commit()
    db.refresh(dispatch)
    return _dispatch_out(dispatch, _assigned_volunteer_count(db, dispatch))


@router.post("/mine/{dispatch_id}/updates", response_model=DispatchAssignmentOut, status_code=201)
def add_officer_update(
    dispatch_id: UUID,
    data: DispatchUpdateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("field_officer", "volunteer")),
):
    dispatch = db.query(Dispatch).filter(
        Dispatch.id == dispatch_id, Dispatch.assigned_to == current_user.id,
    ).with_for_update().first()
    if dispatch is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    expected = DispatchTargetRole.volunteer if current_user.role == UserRole.volunteer else DispatchTargetRole.field_officer
    if dispatch.target_role != expected or dispatch.status == DispatchStatus.completed:
        raise HTTPException(status_code=409, detail="This assignment cannot accept updates")
    if data.kind == "official_instruction":
        raise HTTPException(status_code=422, detail="Only officials can send instructions")
    note = data.note.strip()
    if not note:
        raise HTTPException(status_code=422, detail="Enter an update")
    db.add(DispatchUpdate(dispatch_id=dispatch.id, author_id=current_user.id, kind=data.kind, note=note, media_id=data.media_id))
    if data.kind == "blocker":
        dispatch.status = DispatchStatus.needs_help
    db.commit()
    db.refresh(dispatch)
    return _dispatch_out(dispatch, _assigned_volunteer_count(db, dispatch) if dispatch.target_role == DispatchTargetRole.volunteer else 1)


@router.post("/{dispatch_id}/updates", response_model=DispatchAssignmentOut, status_code=201)
def add_official_update(
    dispatch_id: UUID,
    data: DispatchUpdateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("official")),
):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).with_for_update().first()
    if dispatch is None or dispatch.target_role not in {DispatchTargetRole.field_officer, DispatchTargetRole.volunteer}:
        raise HTTPException(status_code=404, detail="Assignment not found")
    note = data.note.strip()
    if not note:
        raise HTTPException(status_code=422, detail="Enter an instruction")
    db.add(DispatchUpdate(dispatch_id=dispatch.id, author_id=current_user.id, kind="official_instruction", note=note, media_id=data.media_id))
    db.commit()
    db.refresh(dispatch)
    return _dispatch_out(dispatch, _assigned_volunteer_count(db, dispatch) if dispatch.target_role == DispatchTargetRole.volunteer else 1)


@router.patch("/{dispatch_id}/acknowledge-completion", response_model=DispatchAssignmentOut)
def acknowledge_volunteer_completion(
    dispatch_id: UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    dispatch = (
        db.query(Dispatch)
        .filter(
            Dispatch.id == dispatch_id,
            Dispatch.target_role.in_([DispatchTargetRole.volunteer, DispatchTargetRole.field_officer]),
        )
        .with_for_update()
        .first()
    )
    if dispatch is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if dispatch.status != DispatchStatus.completed or not dispatch.completion_note:
        raise HTTPException(status_code=409, detail="This assignment has no completion report to acknowledge")
    if dispatch.completion_acknowledged_at is None:
        dispatch.completion_acknowledged_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(dispatch)
    return _dispatch_out(dispatch, _assigned_volunteer_count(db, dispatch))
