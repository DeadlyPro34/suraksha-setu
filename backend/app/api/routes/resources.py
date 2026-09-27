from fastapi import APIRouter, Depends, Query
from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.resource import Resource
from app.schemas.resource import ResourceOut


router = APIRouter(prefix="/api/resources", tags=["resources"])


@router.get("/", response_model=list[ResourceOut])
def list_resources(
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List registered resources with coordinates when present."""
    resources = (
        db.query(Resource)
        .order_by(Resource.type.asc(), Resource.id.asc())
        .limit(limit)
        .all()
    )
    result = []
    for resource in resources:
        lat = lon = None
        if resource.location:
            point = to_shape(resource.location)
            lat, lon = point.y, point.x
        result.append(
            ResourceOut(
                id=resource.id,
                incident_id=resource.incident_id,
                type=resource.type,
                quantity=resource.quantity,
                lat=lat,
                lon=lon,
                status=resource.status,
            )
        )
    return result
