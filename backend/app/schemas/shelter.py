from uuid import UUID

from pydantic import BaseModel

from app.models.shelter import ShelterStatus


class ShelterOut(BaseModel):
    id: UUID
    name: str
    lat: float
    lon: float
    capacity: int
    current_occupancy: int
    available_capacity: int
    available_percentage: int
    has_electricity: bool
    has_medical: bool
    status: ShelterStatus


class NearbyShelterOut(ShelterOut):
    distance_km: float
    capacity_pct: int
