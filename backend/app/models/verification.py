"""Verification model."""

import enum

from sqlalchemy import Column, Float, Boolean, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, pk_uuid


class VerificationResult(str, enum.Enum):
    verified = "verified"
    rejected = "rejected"
    uncertain = "uncertain"


class Verification(Base):
    __tablename__ = "verifications"

    id = pk_uuid()
    report_id = Column(
        UUID(as_uuid=True), ForeignKey("reports.id"), nullable=False, unique=True
    )
    result = Column(Enum(VerificationResult, name="verification_result"), nullable=False)
    credibility_score = Column(Float, nullable=True)
    image_reuse_flag = Column(Boolean, default=False, nullable=False)
    timestamp_mismatch_flag = Column(Boolean, default=False, nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    # --- relationships ---
    report = relationship("Report", back_populates="verification")
