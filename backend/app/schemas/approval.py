from typing import Literal, Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

class ApprovalCreate(BaseModel):
    decision: Literal["approved", "rejected", "modified"]
    notes: Optional[str] = None
    modified_summary: Optional[str] = None

class ApprovalOut(BaseModel):
    id: UUID
    response_plan_id: UUID
    approved_by: UUID
    decision: Literal["approved", "rejected", "modified"]
    notes: Optional[str]
    modified_summary: Optional[str]
    decided_at: datetime
    action_result: Optional[dict[str, int]] = None

    class Config:
        from_attributes = True


class ResponsePlanSummary(BaseModel):
    id: UUID
    incident_id: UUID
    report_id: Optional[UUID]
    report_description: Optional[str]
    priority_score: float
    summary: str
    status: str
    generated_at: datetime


class FieldOfficerOut(BaseModel):
    id: UUID
    name: str


class DispatchAssignmentIn(BaseModel):
    user_id: UUID


class DispatchAssignmentOut(BaseModel):
    id: UUID
    response_plan_id: UUID
    incident_id: Optional[UUID]
    report_id: Optional[UUID]
    assignee_id: Optional[UUID]
    assignee_name: Optional[str]
    message: str
    status: str
    dispatched_at: Optional[datetime]


class DispatchStatusIn(BaseModel):
    status: Literal["acknowledged"]
