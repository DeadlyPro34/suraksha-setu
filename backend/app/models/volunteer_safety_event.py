"""Persistent SOS events and official safety follow-up."""

from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from .base import Base, pk_uuid


class VolunteerSafetyEvent(Base):
    __tablename__ = "volunteer_safety_events"

    id = pk_uuid()
    volunteer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    dispatch_id = Column(UUID(as_uuid=True), ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(32), nullable=False, default="sos")
    message = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    location_source = Column(String(24), nullable=False, default="task_area", server_default="task_area")
    accuracy_m = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
