from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.elements import WKTElement
from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.shelter import Shelter, ShelterStatus
from app.models.user import User
from app.schemas.shelter import NearbyShelterOut, ShelterMutation, ShelterOut
from app.services.shelter_lookup import haversine_km

router = APIRouter(prefix="/api/shelters", tags=["shelters"])


def _shelter_out(shelter: Shelter) -> ShelterOut:
    point = to_shape(shelter.location)
    available = max(shelter.capacity - shelter.current_occupancy, 0)
    percentage = round(available * 100 / shelter.capacity) if shelter.capacity > 0 else 0
    return ShelterOut(
        id=shelter.id, name=shelter.name, lat=float(point.y), lon=float(point.x),
        capacity=shelter.capacity, current_occupancy=shelter.current_occupancy,
        available_capacity=available, available_percentage=percentage,
        has_electricity=shelter.has_electricity, has_medical=shelter.has_medical,
        status=shelter.status,
    )


@router.get("", response_model=list[ShelterOut], include_in_schema=False)
@router.get("/", response_model=list[ShelterOut])
def list_shelters(
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Return registered shelters with availability derived from occupancy."""
    # Deliberately public: shelter availability is non-sensitive safety information.
    shelters = db.query(Shelter).order_by(Shelter.name.asc()).limit(limit).all()
    return [_shelter_out(shelter) for shelter in shelters]


@router.post("", response_model=ShelterOut, status_code=201)
@router.post("/", response_model=ShelterOut, status_code=201, include_in_schema=False)
def create_shelter(
    data: ShelterMutation,
    db: Session = Depends(get_db),
    _official: User = Depends(require_role("official")),
):
    if data.current_occupancy > data.capacity:
        raise HTTPException(status_code=422, detail="Current occupancy cannot exceed total capacity.")
    shelter = Shelter(
        name=data.name.strip(),
        location=WKTElement(f"POINT({data.lon} {data.lat})", srid=4326),
        capacity=data.capacity,
        current_occupancy=data.current_occupancy,
        has_electricity=data.has_electricity,
        has_medical=data.has_medical,
        status=data.status,
    )
    db.add(shelter)
    db.commit()
    db.refresh(shelter)
    return _shelter_out(shelter)


@router.put("/{shelter_id}", response_model=ShelterOut)
def update_shelter(
    shelter_id: UUID,
    data: ShelterMutation,
    db: Session = Depends(get_db),
    _official: User = Depends(require_role("official")),
):
    shelter = db.query(Shelter).filter(Shelter.id == shelter_id).with_for_update().first()
    if shelter is None:
        raise HTTPException(status_code=404, detail="Shelter not found.")
    if data.current_occupancy > data.capacity:
        raise HTTPException(status_code=422, detail="Current occupancy cannot exceed total capacity.")
    shelter.name = data.name.strip()
    shelter.location = WKTElement(f"POINT({data.lon} {data.lat})", srid=4326)
    shelter.capacity = data.capacity
    shelter.current_occupancy = data.current_occupancy
    shelter.has_electricity = data.has_electricity
    shelter.has_medical = data.has_medical
    shelter.status = data.status
    db.commit()
    db.refresh(shelter)
    return _shelter_out(shelter)


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
