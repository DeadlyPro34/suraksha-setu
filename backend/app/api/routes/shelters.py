from fastapi import APIRouter, Depends, Query
from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.shelter import Shelter
from app.models.user import User
from app.schemas.shelter import NearbyShelterOut, ShelterOut
from app.services.shelter_lookup import haversine_km

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


@router.get("/nearby", response_model=list[NearbyShelterOut])
def list_nearby_shelters(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    shelters = db.query(Shelter).all()
    result = []
    for shelter in shelters:
        if not shelter.location:
            continue
        point = to_shape(shelter.location)
        shelter_lat, shelter_lon = float(point.y), float(point.x)
        capacity_pct = (
            round(shelter.current_occupancy * 100 / shelter.capacity)
            if shelter.capacity > 0
            else 0
        )
        available = max(shelter.capacity - shelter.current_occupancy, 0)
        result.append(
            NearbyShelterOut(
                id=shelter.id,
                name=shelter.name,
                lat=shelter_lat,
                lon=shelter_lon,
                capacity=shelter.capacity,
                current_occupancy=shelter.current_occupancy,
                available_capacity=available,
                available_percentage=(
                    round(available * 100 / shelter.capacity)
                    if shelter.capacity > 0
                    else 0
                ),
                capacity_pct=capacity_pct,
                distance_km=haversine_km(lat, lon, shelter_lat, shelter_lon),
                has_electricity=shelter.has_electricity,
                has_medical=shelter.has_medical,
                status=shelter.status,
            )
        )
    return sorted(result, key=lambda shelter: shelter.distance_km)
