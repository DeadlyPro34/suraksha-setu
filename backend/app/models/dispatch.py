"""Simulated instructions sent to field teams."""

import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Text, func
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
    en_route = "en_route"
    arrived = "arrived"
    needs_help = "needs_help"


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
    completion_acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    instructions = Column(Text, nullable=True)
    due_at = Column(DateTime(timezone=True), nullable=True)
    shift_starts_at = Column(DateTime(timezone=True), nullable=True)
    shift_ends_at = Column(DateTime(timezone=True), nullable=True)
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    checked_out_at = Column(DateTime(timezone=True), nullable=True)
    missed_checkin_acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    meeting_point = Column(Text, nullable=True)
    support_request_id = Column(UUID(as_uuid=True), ForeignKey("field_officer_support_requests.id", ondelete="SET NULL"), nullable=True, index=True)
    target_role = Column(
        Enum(DispatchTargetRole, name="dispatch_target_role"), nullable=False
    )
    message = Column(Text, nullable=False)
    status = Column(Enum(DispatchStatus, name="dispatch_status"), nullable=False)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)

    response_plan = relationship("ResponsePlan", back_populates="dispatches")
    assignee = relationship("User", back_populates="dispatches")
    updates = relationship(
        "DispatchUpdate", back_populates="dispatch", cascade="all, delete-orphan",
        order_by="DispatchUpdate.created_at",
    )
    support_request = relationship("FieldOfficerSupportRequest", back_populates="volunteer_dispatches", foreign_keys=[support_request_id])
    support_requests = relationship("FieldOfficerSupportRequest", back_populates="dispatch", foreign_keys="FieldOfficerSupportRequest.dispatch_id", cascade="all, delete-orphan", order_by="FieldOfficerSupportRequest.created_at")


class FieldOfficerSupportRequest(Base):
    __tablename__ = "field_officer_support_requests"

    id = pk_uuid()
    dispatch_id = Column(UUID(as_uuid=True), ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    support_type = Column(Text, nullable=False, default="general", server_default="general")
    volunteers_needed = Column(Integer, nullable=False)
    details = Column(Text, nullable=False)
    location = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default="pending", server_default="pending")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    dispatch = relationship("Dispatch", foreign_keys=[dispatch_id], back_populates="support_requests")
    requester = relationship("User", foreign_keys=[requested_by])
    volunteer_dispatches = relationship("Dispatch", back_populates="support_request", foreign_keys="Dispatch.support_request_id")
    messages = relationship("FieldOfficerSupportMessage", back_populates="support_request", cascade="all, delete-orphan", order_by="FieldOfficerSupportMessage.created_at")


class FieldOfficerSupportMessage(Base):
    __tablename__ = "field_officer_support_messages"

    id = pk_uuid()
    support_request_id = Column(UUID(as_uuid=True), ForeignKey("field_officer_support_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    support_request = relationship("FieldOfficerSupportRequest", back_populates="messages")
    author = relationship("User")


class DispatchUpdate(Base):
    __tablename__ = "dispatch_updates"

    id = pk_uuid()
    dispatch_id = Column(UUID(as_uuid=True), ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    kind = Column(Text, nullable=False)
    note = Column(Text, nullable=False)
    media_id = Column(UUID(as_uuid=True), nullable=True)
    remaining_work = Column(Text, nullable=True)
    resources_used = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    dispatch = relationship("Dispatch", back_populates="updates")
    author = relationship("User")
