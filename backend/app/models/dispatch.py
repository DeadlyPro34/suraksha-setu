"""Simulated instructions sent to field teams."""

import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, pk_uuid


class DispatchTargetRole(str, enum.Enum):
    field_officer = "field_officer"
    volunteer = "volunteer"
    official = "official"


class DispatchStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    acknowledged = "acknowledged"
    completed = "completed"


class Dispatch(Base):
    __tablename__ = "dispatches"

    id = pk_uuid()
    response_plan_id = Column(
        UUID(as_uuid=True), ForeignKey("response_plans.id"), nullable=False
    )
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    task_group_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    volunteers_needed = Column(Integer, nullable=False, default=1, server_default="1")
    completion_note = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    target_role = Column(
        Enum(DispatchTargetRole, name="dispatch_target_role"), nullable=False
    )
    message = Column(Text, nullable=False)
    status = Column(Enum(DispatchStatus, name="dispatch_status"), nullable=False)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)

    response_plan = relationship("ResponsePlan", back_populates="dispatches")
    assignee = relationship("User", back_populates="dispatches")
