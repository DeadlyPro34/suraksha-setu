"""Incident model."""

import enum

from sqlalchemy import Column, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry

from .base import Base, pk_uuid


class IncidentSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IncidentStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"


class Incident(Base):
    __tablename__ = "incidents"

    id = pk_uuid()
    report_id = Column(
        UUID(as_uuid=True), ForeignKey("reports.id"), nullable=True, unique=True
    )
    location = Column(Geometry("POINT", srid=4326), nullable=False)
    severity = Column(Enum(IncidentSeverity, name="incident_severity"), nullable=False)
    status = Column(
        Enum(IncidentStatus, name="incident_status"),
        nullable=False,
        default=IncidentStatus.open,
    )
    start_time = Column(DateTime(timezone=True), nullable=False)

    # --- relationships ---
    report = relationship("Report", back_populates="incident")
    response_plans = relationship("ResponsePlan", back_populates="incident")
    alerts = relationship("Alert", back_populates="incident")
    resources = relationship("Resource", back_populates="incident")
