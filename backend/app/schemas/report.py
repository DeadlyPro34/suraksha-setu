from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.report import ReportType, ReportStatus

class ReportCreate(BaseModel):
    reporter_id: Optional[UUID] = None
    type: ReportType
    description: str = Field(min_length=1, max_length=5000)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    image_url: Optional[str] = None

class ReportOut(BaseModel):
    id: UUID
    reporter_id: Optional[UUID] = None
    type: ReportType
    description: str
    lat: float
    lon: float
    status: ReportStatus
    created_at: datetime
    
    class Config:
        from_attributes = True
