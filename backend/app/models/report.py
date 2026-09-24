"""Report model."""

import enum

from sqlalchemy import Column, String, Text, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry

from .base import Base, pk_uuid, created_at_col


class ReportType(str, enum.Enum):
    flood = "flood"
    road_block = "road_block"
    medical = "medical"
    other = "other"


class ReportStatus(str, enum.Enum):
    pending_verification = "pending_verification"
    verified = "verified"
    rejected = "rejected"


class Report(Base):
    __tablename__ = "reports"

    id = pk_uuid()
    # Reports can be submitted before citizen authentication is implemented.
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    type = Column(Enum(ReportType, name="report_type"), nullable=False)
    description = Column(Text, nullable=False)
    location = Column(Geometry("POINT", srid=4326), nullable=False)
    image_url = Column(String, nullable=True)
    status = Column(
        Enum(ReportStatus, name="report_status"),
        nullable=False,
        default=ReportStatus.pending_verification,
    )
    created_at = created_at_col()

    # --- relationships ---
    reporter = relationship("User", back_populates="reports")
    verification = relationship(
        "Verification", back_populates="report", uselist=False
    )
    incident = relationship("Incident", back_populates="report", uselist=False)
