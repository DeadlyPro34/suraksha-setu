from fastapi import APIRouter, Depends, Query
from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.alert import Alert, AlertType
from app.models.incident import Incident
from app.schemas.alert import AlertMapOut, AlertOut
from app.models.user import User
from app.core.dependencies import require_role

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


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
        point = to_shape(alert.incident.location) if alert.incident and alert.incident.location else None
        result.append(AlertMapOut(
            id=alert.id,
            incident_id=alert.incident_id,
            type=alert.type,
            message=alert.message,
            language=alert.language,
            sent_at=alert.sent_at,
            lat=float(point.y) if point else None,
            lon=float(point.x) if point else None,
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
        .order_by(Alert.sent_at.desc().nullslast(), Alert.id.desc())
        .limit(limit)
        .all()
    )
    result = []
    for alert in alerts:
        point = to_shape(alert.incident.location) if alert.incident and alert.incident.location else None
        result.append(AlertMapOut(
            id=alert.id,
            incident_id=alert.incident_id,
            type=alert.type,
            message=alert.message,
            language=alert.language,
            sent_at=alert.sent_at,
            lat=float(point.y) if point else None,
            lon=float(point.x) if point else None,
        ))
    return result
