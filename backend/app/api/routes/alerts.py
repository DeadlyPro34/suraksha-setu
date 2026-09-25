from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertOut

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
