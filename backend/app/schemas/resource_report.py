from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.resource import ResourceType


class ResourceReportCreate(BaseModel):
    resource_type: ResourceType
    quantity: int = Field(ge=0, le=10_000_000)
    location_name: str = Field(min_length=2, max_length=200)
    note: str = Field(min_length=3, max_length=2000)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lon: Optional[float] = Field(default=None, ge=-180, le=180)


class ResourceReportReview(BaseModel):
    decision: Literal["approved", "rejected"]
    review_note: Optional[str] = Field(default=None, max_length=2000)


class ResourceReportOut(BaseModel):
    id: UUID
    resource_type: ResourceType
    quantity: int
    location_name: str
    note: str
    lat: Optional[float]
    lon: Optional[float]
    status: Literal["pending", "approved", "rejected"]
    submitted_by: UUID
    submitter_name: str
    submitted_at: datetime
    reviewed_by: Optional[UUID]
    reviewer_name: Optional[str]
    reviewed_at: Optional[datetime]
    review_note: Optional[str]
