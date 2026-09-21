"""Alert model."""

import enum

from sqlalchemy import Column, String, Text, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, pk_uuid


class AlertType(str, enum.Enum):
    evacuation = "evacuation"
    warning = "warning"
    resupply = "resupply"
    all_clear = "all_clear"


class Alert(Base):
    __tablename__ = "alerts"

    id = pk_uuid()
    incident_id = Column(
        UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False
    )
    type = Column(Enum(AlertType, name="alert_type"), nullable=False)
    message = Column(Text, nullable=False)
    language = Column(String, default="en", nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    # --- relationships ---
    incident = relationship("Incident", back_populates="alerts")
