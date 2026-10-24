"""Supply requests and their delivery confirmation lifecycle."""

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, pk_uuid


class SupplyRequest(Base):
    __tablename__ = "supply_requests"

    id = pk_uuid()
    requester_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    source_resource_report_id = Column(UUID(as_uuid=True), ForeignKey("resource_reports.id", ondelete="SET NULL"), nullable=True, unique=True)
    stock_source_resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="SET NULL"), nullable=True)
    requester_role = Column(String(24), nullable=False)
    resource_type = Column(String(32), nullable=False)
    requested_quantity = Column(Integer, nullable=False)
    approved_quantity = Column(Integer, nullable=True)
    dispatched_quantity = Column(Integer, nullable=True)
    location_name = Column(String(200), nullable=False)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    note = Column(Text, nullable=False)
    status = Column(String(24), nullable=False, default="pending", server_default="pending", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(Text, nullable=True)
    delivery_handler = Column(String(200), nullable=True)
    dispatch_note = Column(Text, nullable=True)
    dispatched_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)
    received_quantity = Column(Integer, nullable=True)
    receipt_note = Column(Text, nullable=True)
    receipt_status = Column(String(32), nullable=False, default="awaiting_confirmation", server_default="awaiting_confirmation")
    received_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    official_close_note = Column(Text, nullable=True)
    closed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    requester = relationship("User", foreign_keys=[requester_id])
    source_resource_report = relationship("ResourceReport")
    stock_source_resource = relationship("Resource", foreign_keys=[stock_source_resource_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    dispatcher = relationship("User", foreign_keys=[dispatched_by])
    receiver = relationship("User", foreign_keys=[received_by])
    closer = relationship("User", foreign_keys=[closed_by])
