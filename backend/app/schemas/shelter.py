from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

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
    updated_at: datetime | None = None


class NearbyShelterOut(ShelterOut):
    distance_km: float
    capacity_pct: int


class ShelterMutation(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    capacity: int = Field(ge=1, le=1_000_000)
    current_occupancy: int = Field(ge=0, le=1_000_000)
    has_electricity: bool = False
    has_medical: bool = False
    status: ShelterStatus = ShelterStatus.open
