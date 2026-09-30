from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.alert import Alert, AlertType
from app.schemas.alert import AlertOut
from app.models.user import User

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("/", response_model=list[AlertOut])
def list_alerts(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Return the newest alerts that have actually been recorded."""
    return (
        db.query(Alert)
        .order_by(Alert.sent_at.desc().nullslast(), Alert.id.desc())
        .limit(limit)
        .all()
    )


@router.get("/nearby", response_model=list[AlertOut])
def list_recent_citizen_alerts(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    # First pass returns recent active alerts regardless of distance; applying
    # a geographic radius filter can be added when citizens opt in to location.
    return (
        db.query(Alert)
        .filter(Alert.type != AlertType.all_clear)
        .order_by(Alert.sent_at.desc().nullslast(), Alert.id.desc())
        .limit(limit)
        .all()
    )
