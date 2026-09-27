from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.alert import AlertType


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    incident_id: UUID
    type: AlertType
    message: str
    language: str
    sent_at: datetime | None
