from fastapi import APIRouter, Depends, Query
from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.shelter import Shelter
from app.schemas.shelter import ShelterOut

router = APIRouter(prefix="/api/shelters", tags=["shelters"])


@router.get("/", response_model=list[ShelterOut])
def list_shelters(
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Return registered shelters with availability derived from occupancy."""
    shelters = db.query(Shelter).order_by(Shelter.name.asc()).limit(limit).all()
    result = []
    for shelter in shelters:
        point = to_shape(shelter.location)
        available = max(shelter.capacity - shelter.current_occupancy, 0)
        available_percentage = round(available * 100 / shelter.capacity) if shelter.capacity > 0 else 0
        result.append(
            ShelterOut(
                id=shelter.id,
                name=shelter.name,
                lat=point.y,
                lon=point.x,
                capacity=shelter.capacity,
                current_occupancy=shelter.current_occupancy,
                available_capacity=available,
                available_percentage=available_percentage,
                has_electricity=shelter.has_electricity,
                has_medical=shelter.has_medical,
                status=shelter.status,
            )
        )
    return result
