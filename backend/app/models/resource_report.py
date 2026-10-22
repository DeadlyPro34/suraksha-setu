"""Submitted resource counts awaiting official review."""

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from .base import Base, pk_uuid


class ResourceReport(Base):
    __tablename__ = "resource_reports"

    id = pk_uuid()
    resource_type = Column(String(32), nullable=False)
    quantity = Column(Integer, nullable=False)
    location_name = Column(String(200), nullable=False)
    note = Column(Text, nullable=False)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    submitted_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(Text, nullable=True)
