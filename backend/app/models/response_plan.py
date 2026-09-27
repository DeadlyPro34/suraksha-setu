"""ResponsePlan model."""

import enum

from sqlalchemy import Column, Float, Text, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, pk_uuid


class PlanStatus(str, enum.Enum):
    pending_approval = "pending_approval"
    approved = "approved"
    rejected = "rejected"
    modified = "modified"


class ResponsePlan(Base):
    __tablename__ = "response_plans"

    id = pk_uuid()
    incident_id = Column(
        UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False
    )
    priority_score = Column(Float, nullable=False)
    summary = Column(Text, nullable=False)
    status = Column(
        Enum(PlanStatus, name="plan_status"),
        nullable=False,
        default=PlanStatus.pending_approval,
    )
    generated_at = Column(DateTime(timezone=True), nullable=False)

    # --- relationships ---
    incident = relationship("Incident", back_populates="response_plans")
    approval = relationship("Approval", back_populates="response_plan", uselist=False)
    dispatches = relationship("Dispatch", back_populates="response_plan")
