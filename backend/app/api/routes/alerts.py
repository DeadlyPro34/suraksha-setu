from fastapi import APIRouter, Depends, Query
from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.alert import Alert, AlertType
from app.models.incident import Incident
from app.schemas.alert import AlertMapOut, AlertOut
from app.models.user import User
from app.core.dependencies import require_role

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _map_coordinates(incident):
    """Keep missing/Null Island coordinates out of local response maps."""
    if not incident or not incident.location:
        return None, None
    point = to_shape(incident.location)
    lat, lon = float(point.y), float(point.x)
    if lat == 0 and lon == 0:
        return None, None
    return lat, lon


@router.get("/public", response_model=list[AlertMapOut])
def list_public_alerts(
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Return current public safety notices without requiring an account."""
    alerts = (
        db.query(Alert)
        .options(joinedload(Alert.incident))
        .filter(Alert.active_until > datetime.now(timezone.utc))
        .order_by(Alert.sent_at.desc().nullslast(), Alert.id.desc())
        .limit(limit)
        .all()
    )
    return [
        AlertMapOut(
            id=alert.id,
            incident_id=alert.incident_id,
            type=alert.type,
            message=alert.message,
            language=alert.language,
            sent_at=alert.sent_at,
            active_until=alert.active_until,
            lat=_map_coordinates(alert.incident)[0],
            lon=_map_coordinates(alert.incident)[1],
        )
        for alert in alerts
    ]


@router.get("/map", response_model=list[AlertMapOut])
def list_alerts_for_map(
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official", "field_officer")),
):
    """Return alerts with their incident coordinates for the response map."""
    alerts = (
        db.query(Alert)
        .options(joinedload(Alert.incident))
        .order_by(Alert.sent_at.desc().nullslast(), Alert.id.desc())
        .limit(limit)
        .all()
    )
    result = []
    for alert in alerts:
        lat, lon = _map_coordinates(alert.incident)
        result.append(AlertMapOut(
            id=alert.id,
            incident_id=alert.incident_id,
            type=alert.type,
            message=alert.message,
            language=alert.language,
            sent_at=alert.sent_at,
            active_until=alert.active_until,
            lat=lat,
            lon=lon,
        ))
    return result


@router.get("", response_model=list[AlertOut], include_in_schema=False)
@router.get("/", response_model=list[AlertOut])
def list_alerts(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("official", "field_officer")),
):
    """Return the newest alerts that have actually been recorded."""
    return (
        db.query(Alert)
        .order_by(Alert.sent_at.desc().nullslast(), Alert.id.desc())
        .limit(limit)
        .all()
    )


@router.get("/nearby", response_model=list[AlertMapOut])
def list_recent_citizen_alerts(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    # First pass returns recent active alerts regardless of distance; applying
    # a geographic radius filter can be added when citizens opt in to location.
    alerts = (
        db.query(Alert)
        .options(joinedload(Alert.incident))
        .filter(Alert.type != AlertType.all_clear)
        .filter(Alert.active_until > datetime.now(timezone.utc))
        .order_by(Alert.sent_at.desc().nullslast(), Alert.id.desc())
        .limit(limit)
        .all()
    )
    result = []
    for alert in alerts:
        lat, lon = _map_coordinates(alert.incident)
        result.append(AlertMapOut(
            id=alert.id,
            incident_id=alert.incident_id,
            type=alert.type,
            message=alert.message,
            language=alert.language,
            sent_at=alert.sent_at,
            active_until=alert.active_until,
            lat=lat,
            lon=lon,
        ))
    return result
