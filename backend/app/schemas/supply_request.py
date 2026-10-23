from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.resource import ResourceType


class SupplyRequestCreate(BaseModel):
    resource_type: ResourceType
    requested_quantity: int = Field(ge=1, le=1_000_000)
    location_name: str = Field(min_length=2, max_length=200)
    note: str = Field(min_length=3, max_length=2000)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lon: Optional[float] = Field(default=None, ge=-180, le=180)


class SupplyRequestReview(BaseModel):
    decision: Literal["approved", "rejected"]
    approved_quantity: Optional[int] = Field(default=None, ge=1, le=1_000_000)
    review_note: Optional[str] = Field(default=None, max_length=2000)


class SupplyRequestDispatch(BaseModel):
    stock_source_resource_id: UUID
    delivery_handler: str = Field(min_length=2, max_length=200)
    dispatch_note: str = Field(min_length=3, max_length=2000)


class SupplyRequestReceipt(BaseModel):
    received_quantity: int = Field(ge=0, le=1_000_000)
    receipt_note: Optional[str] = Field(default=None, max_length=2000)


class SupplyRequestOfficialClose(BaseModel):
    received_quantity: int = Field(ge=0, le=1_000_000)
    reason: Optional[str] = Field(default=None, max_length=2000)


class SupplyRequestOut(BaseModel):
    id: UUID
    requester_id: UUID
    requester_name: str
    requester_role: str
    resource_type: ResourceType
    requested_quantity: int
    approved_quantity: Optional[int]
    stock_source_resource_id: Optional[UUID]
    stock_source_location: Optional[str]
    location_name: str
    lat: Optional[float]
    lon: Optional[float]
    note: str
    status: Literal["pending", "approved", "rejected", "dispatched", "receipt_submitted", "delivery_issue", "delivered"]
    created_at: datetime
    reviewed_by: Optional[UUID]
    reviewer_name: Optional[str]
    reviewed_at: Optional[datetime]
    review_note: Optional[str]
    delivery_handler: Optional[str]
    dispatch_note: Optional[str]
    dispatched_by: Optional[UUID]
    dispatcher_name: Optional[str]
    dispatched_at: Optional[datetime]
    received_quantity: Optional[int]
    receipt_note: Optional[str]
    receipt_status: str
    received_by: Optional[UUID]
    receiver_name: Optional[str]
    received_at: Optional[datetime]
    official_close_note: Optional[str]
    closed_by: Optional[UUID]
    closer_name: Optional[str]
    closed_at: Optional[datetime]
