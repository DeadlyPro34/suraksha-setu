from typing import Literal, Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

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


class VolunteerOut(BaseModel):
    id: UUID
    name: str
    phone: str


class VolunteerTaskCreate(BaseModel):
    response_plan_id: UUID
    message: str = Field(min_length=5, max_length=2000)
    volunteers_needed: int = Field(default=1, ge=1, le=25)


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
    target_role: str
    task_group_id: Optional[UUID] = None
    volunteers_needed: int = 1
    volunteers_assigned: int = 1
    completion_note: Optional[str] = None
    completed_at: Optional[datetime] = None


class DispatchStatusIn(BaseModel):
    status: Literal["acknowledged"]


class VolunteerCompletionIn(BaseModel):
    completion_note: str = Field(min_length=1, max_length=2000)
