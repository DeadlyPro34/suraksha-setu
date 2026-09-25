from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.alert import AlertType


class AlertOut(BaseModel):
    id: UUID
    incident_id: UUID
    type: AlertType
    message: str
    language: str
    sent_at: datetime | None
