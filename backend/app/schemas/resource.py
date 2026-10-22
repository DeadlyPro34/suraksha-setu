from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.models.resource import ResourceStatus, ResourceType


class ResourceOut(BaseModel):
    id: UUID
    incident_id: Optional[UUID]
    type: ResourceType
    quantity: int
    location_name: str = "Regional stock"
    lat: Optional[float]
    lon: Optional[float]
    status: ResourceStatus
