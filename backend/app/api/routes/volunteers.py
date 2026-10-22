"""Volunteer profile, task-scoped location sharing, and official live map feed."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.dispatch import Dispatch, DispatchStatus, DispatchTargetRole
from app.models.user import User
from app.models.volunteer_location import VolunteerLocation
from app.models.volunteer_safety_event import VolunteerSafetyEvent
from app.schemas.approval import (
    VolunteerLocationOut,
    VolunteerLocationUpdate,
    VolunteerProfileOut,
    VolunteerProfileUpdate,
    VolunteerSafetyEventOut,
    VolunteerSOSCreate,
)


router = APIRouter(prefix="/api/volunteers", tags=["volunteers"])


def _profile_out(user: User) -> VolunteerProfileOut:
    return VolunteerProfileOut(
        id=user.id,
        name=user.name,
        phone=user.phone,
        available=user.volunteer_available,
        skills=user.volunteer_skills,
        languages=user.volunteer_languages,
        has_transport=user.volunteer_has_transport,
    )


def _own_active_dispatch(db: Session, dispatch_id: UUID, user: User) -> Dispatch:
    dispatch = (
        db.query(Dispatch)
        .filter(
            Dispatch.id == dispatch_id,
            Dispatch.assigned_to == user.id,
            Dispatch.target_role == DispatchTargetRole.volunteer,
        )
        .with_for_update()
        .first()
    )
    if dispatch is None:
        raise HTTPException(status_code=404, detail="Volunteer assignment not found")
    if dispatch.status == DispatchStatus.completed:
        raise HTTPException(status_code=409, detail="This task is already complete")
    return dispatch


def _incident_coordinates(dispatch: Dispatch):
    incident = dispatch.response_plan.incident if dispatch.response_plan else None
    if not incident or not incident.location:
        return None, None
    point = to_shape(incident.location)
    lat, lon = float(point.y), float(point.x)
    return (None, None) if lat == 0 and lon == 0 else (lat, lon)


@router.get("/me/profile", response_model=VolunteerProfileOut)
def get_my_volunteer_profile(
    current_user: User = Depends(require_role("volunteer")),
):
    return _profile_out(current_user)


@router.patch("/me/profile", response_model=VolunteerProfileOut)
def update_my_volunteer_profile(
    data: VolunteerProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer")),
):
    user = db.query(User).filter(User.id == current_user.id).with_for_update().first()
    if user is None:
        raise HTTPException(status_code=404, detail="Volunteer account not found")
    user.volunteer_available = data.available
    user.volunteer_skills = (data.skills or "").strip() or None
    user.volunteer_languages = (data.languages or "").strip() or None
    user.volunteer_has_transport = data.has_transport
    db.commit()
    db.refresh(user)
    return _profile_out(user)


@router.post("/me/location")
def share_my_location(
    data: VolunteerLocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer")),
):
    dispatch = (
        db.query(Dispatch)
        .filter(
            Dispatch.id == data.dispatch_id,
            Dispatch.assigned_to == current_user.id,
            Dispatch.target_role == DispatchTargetRole.volunteer,
            Dispatch.status != DispatchStatus.completed,
        )
        .first()
    )
    if dispatch is None:
        raise HTTPException(status_code=404, detail="Active volunteer assignment not found")

    location = db.query(VolunteerLocation).filter(
        VolunteerLocation.volunteer_id == current_user.id
    ).with_for_update().first()
    now = datetime.now(timezone.utc)
    if location is None:
        location = VolunteerLocation(
            volunteer_id=current_user.id,
            dispatch_id=dispatch.id,
            lat=data.lat,
            lon=data.lon,
            updated_at=now,
        )
        db.add(location)
    else:
        location.dispatch_id = dispatch.id
        location.lat = data.lat
        location.lon = data.lon
        location.updated_at = now
    db.commit()
    return {"sharing": True, "updated_at": now}


@router.delete("/me/location")
def stop_sharing_location(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer")),
):
    db.query(VolunteerLocation).filter(
        VolunteerLocation.volunteer_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()
    return {"sharing": False}


@router.post("/me/dispatches/{dispatch_id}/check-in")
def check_in_to_shift(
    dispatch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer")),
):
    dispatch = _own_active_dispatch(db, dispatch_id, current_user)
    if dispatch.checked_in_at is not None:
        raise HTTPException(status_code=409, detail="You have already checked in to this shift")
    now = datetime.now(timezone.utc)
    dispatch.checked_in_at = now
    dispatch.checked_out_at = None
    if dispatch.status == DispatchStatus.sent:
        dispatch.status = DispatchStatus.acknowledged
    db.commit()
    return {"checked_in_at": now, "checked_out_at": None}


@router.post("/me/dispatches/{dispatch_id}/check-out")
def check_out_from_shift(
    dispatch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer")),
):
    dispatch = _own_active_dispatch(db, dispatch_id, current_user)
    if dispatch.checked_in_at is None:
        raise HTTPException(status_code=409, detail="Check in before checking out")
    if dispatch.checked_out_at is not None:
        raise HTTPException(status_code=409, detail="You have already checked out of this shift")
    now = datetime.now(timezone.utc)
    dispatch.checked_out_at = now
    db.commit()
    return {"checked_in_at": dispatch.checked_in_at, "checked_out_at": now}


@router.post("/me/dispatches/{dispatch_id}/sos", response_model=VolunteerSafetyEventOut, status_code=201)
def send_sos(
    dispatch_id: UUID,
    data: VolunteerSOSCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer")),
):
    dispatch = _own_active_dispatch(db, dispatch_id, current_user)
    if (data.lat is None) != (data.lon is None):
        raise HTTPException(status_code=422, detail="Provide both latitude and longitude")

    lat, lon = data.lat, data.lon
    location_source = "current_device" if lat is not None else "unavailable"
    recent_location = db.query(VolunteerLocation).filter(
        VolunteerLocation.volunteer_id == current_user.id,
        VolunteerLocation.dispatch_id == dispatch.id,
    ).first()
    if lat is None and recent_location is not None and recent_location.updated_at >= datetime.now(timezone.utc) - timedelta(minutes=2):
        lat, lon = recent_location.lat, recent_location.lon
        location_source = "last_shared"
    if lat is None:
        lat, lon = _incident_coordinates(dispatch)
        if lat is not None:
            location_source = "task_area"
    if lat == 0 and lon == 0:
        lat = lon = None

    now = datetime.now(timezone.utc)
    event = VolunteerSafetyEvent(
        volunteer_id=current_user.id,
        dispatch_id=dispatch.id,
        event_type="sos",
        message=(data.message or "Volunteer requested urgent assistance").strip(),
        lat=lat,
        lon=lon,
        location_source=location_source,
        accuracy_m=data.accuracy_m if location_source == "current_device" else None,
        created_at=now,
    )
    dispatch.status = DispatchStatus.needs_help
    db.add(event)
    db.commit()
    db.refresh(event)
    return VolunteerSafetyEventOut(
        id=str(event.id), event_type=event.event_type, volunteer_id=current_user.id,
        volunteer_name=current_user.name, phone=current_user.phone, dispatch_id=dispatch.id,
        task=dispatch.message, message=event.message, lat=event.lat, lon=event.lon,
        created_at=event.created_at, shift_starts_at=dispatch.shift_starts_at,
        location_source=event.location_source, accuracy_m=event.accuracy_m,
    )


@router.get("/safety-events", response_model=list[VolunteerSafetyEventOut])
def list_open_safety_events(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    now = datetime.now(timezone.utc)
    open_events = (
        db.query(VolunteerSafetyEvent, User, Dispatch)
        .join(User, User.id == VolunteerSafetyEvent.volunteer_id)
        .join(Dispatch, Dispatch.id == VolunteerSafetyEvent.dispatch_id)
        .filter(VolunteerSafetyEvent.resolved_at.is_(None))
        .order_by(VolunteerSafetyEvent.created_at.desc())
        .all()
    )
    result = [VolunteerSafetyEventOut(
        id=str(event.id), event_type=event.event_type, volunteer_id=user.id,
        volunteer_name=user.name, phone=user.phone, dispatch_id=dispatch.id,
        task=dispatch.message, message=event.message, lat=event.lat, lon=event.lon,
        created_at=event.created_at, shift_starts_at=dispatch.shift_starts_at,
        location_source=event.location_source, accuracy_m=event.accuracy_m,
    ) for event, user, dispatch in open_events]

    grace_period = timedelta(minutes=10)
    missed_checkins = (
        db.query(Dispatch, User)
        .join(User, User.id == Dispatch.assigned_to)
        .filter(
            Dispatch.target_role == DispatchTargetRole.volunteer,
            Dispatch.status != DispatchStatus.completed,
            Dispatch.shift_starts_at.is_not(None),
            Dispatch.shift_starts_at <= now - grace_period,
            Dispatch.checked_in_at.is_(None),
            Dispatch.checked_out_at.is_(None),
            Dispatch.missed_checkin_acknowledged_at.is_(None),
        )
        .order_by(Dispatch.shift_starts_at.asc())
        .all()
    )
    for dispatch, user in missed_checkins:
        lat, lon = _incident_coordinates(dispatch)
        result.append(VolunteerSafetyEventOut(
            id=f"missed-{dispatch.id}", event_type="missed_checkin",
            volunteer_id=user.id, volunteer_name=user.name, phone=user.phone,
            dispatch_id=dispatch.id, task=dispatch.message,
            message="Volunteer has not checked in within 10 minutes of shift start.",
            lat=lat, lon=lon, created_at=dispatch.shift_starts_at + grace_period,
            shift_starts_at=dispatch.shift_starts_at, location_source="task_area",
        ))
    return sorted(result, key=lambda item: item.created_at, reverse=True)


@router.patch("/safety-events/{event_id}/resolve")
def resolve_safety_event(
    event_id: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    if event_id.startswith("missed-"):
        try:
            dispatch_id = UUID(event_id.removeprefix("missed-"))
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Safety event not found") from exc
        dispatch = db.query(Dispatch).filter(
            Dispatch.id == dispatch_id,
            Dispatch.target_role == DispatchTargetRole.volunteer,
        ).with_for_update().first()
        if dispatch is None:
            raise HTTPException(status_code=404, detail="Missed check-in event not found")
        dispatch.missed_checkin_acknowledged_at = datetime.now(timezone.utc)
        db.commit()
        return {"resolved": True, "resolved_at": dispatch.missed_checkin_acknowledged_at}
    try:
        parsed_event_id = UUID(event_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Safety event not found") from exc
    event = db.query(VolunteerSafetyEvent).filter(
        VolunteerSafetyEvent.id == parsed_event_id,
        VolunteerSafetyEvent.resolved_at.is_(None),
    ).with_for_update().first()
    if event is None:
        raise HTTPException(status_code=404, detail="Open SOS event not found")
    event.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {"resolved": True, "resolved_at": event.resolved_at}


@router.get("/locations", response_model=list[VolunteerLocationOut])
def list_sharing_volunteer_locations(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official")),
):
    fresh_after = datetime.now(timezone.utc) - timedelta(minutes=2)
    rows = (
        db.query(VolunteerLocation, User, Dispatch)
        .join(User, User.id == VolunteerLocation.volunteer_id)
        .join(Dispatch, Dispatch.id == VolunteerLocation.dispatch_id)
        .filter(
            Dispatch.target_role == DispatchTargetRole.volunteer,
            Dispatch.status != DispatchStatus.completed,
            VolunteerLocation.updated_at >= fresh_after,
        )
        .order_by(VolunteerLocation.updated_at.desc())
        .all()
    )
    return [VolunteerLocationOut(
        volunteer_id=user.id,
        volunteer_name=user.name,
        dispatch_id=dispatch.id,
        task_group_id=dispatch.task_group_id,
        task=dispatch.message,
        status=dispatch.status.value,
        lat=location.lat,
        lon=location.lon,
        updated_at=location.updated_at,
    ) for location, user, dispatch in rows]
