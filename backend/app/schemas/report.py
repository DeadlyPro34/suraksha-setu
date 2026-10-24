from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.report import ReportType, ReportStatus

class ReportLocationIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class ReportCreate(BaseModel):
    type: ReportType
    description: str = Field(min_length=1, max_length=5000)
    location: ReportLocationIn
    image_url: Optional[str] = None
    # Invisible honeypot used to reject basic automated form submissions.
    website: str = Field(default="", max_length=200)

class ReportOut(BaseModel):
    id: UUID
    reporter_id: Optional[UUID] = None
    type: ReportType
    description: str
    lat: float
    lon: float
    status: ReportStatus
    created_at: datetime
    verification_result: Optional[str] = None
    image_url: Optional[str] = None
    
    class Config:
        from_attributes = True
