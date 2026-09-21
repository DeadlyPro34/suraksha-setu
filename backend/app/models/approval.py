"""Approval model."""

import enum

from sqlalchemy import Column, Text, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, pk_uuid


class ApprovalDecision(str, enum.Enum):
    approved = "approved"
    rejected = "rejected"
    modified = "modified"


class Approval(Base):
    __tablename__ = "approvals"

    id = pk_uuid()
    response_plan_id = Column(
        UUID(as_uuid=True),
        ForeignKey("response_plans.id"),
        nullable=False,
        unique=True,
    )
    approved_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    decision = Column(
        Enum(ApprovalDecision, name="approval_decision"), nullable=False
    )
    notes = Column(Text, nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=False)

    # --- relationships ---
    response_plan = relationship("ResponsePlan", back_populates="approval")
    approver = relationship("User", back_populates="approvals")
