"""Current opt-in locations for volunteers sharing during active tasks."""

from sqlalchemy import Column, DateTime, Float, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID

from .base import Base


class VolunteerLocation(Base):
    __tablename__ = "volunteer_locations"

    volunteer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    dispatch_id = Column(UUID(as_uuid=True), ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
