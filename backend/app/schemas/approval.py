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
    available: bool = False
    skills: Optional[str] = None
    languages: Optional[str] = None
    has_transport: bool = False


class VolunteerTaskCreate(BaseModel):
    response_plan_id: UUID
    message: str = Field(min_length=5, max_length=2000)
    volunteers_needed: int = Field(default=1, ge=1, le=25)
    shift_starts_at: Optional[datetime] = None
    shift_ends_at: Optional[datetime] = None
    meeting_point: Optional[str] = Field(default=None, max_length=1000)


class DispatchAssignmentIn(BaseModel):
    user_id: UUID
    instructions: Optional[str] = Field(default=None, max_length=4000)
    due_at: Optional[datetime] = None
    meeting_point: Optional[str] = Field(default=None, max_length=1000)


class DispatchUpdateCreate(BaseModel):
    kind: Literal["progress", "blocker", "official_instruction"]
    note: str = Field(min_length=1, max_length=4000)
    media_id: Optional[UUID] = None


class DispatchUpdateOut(BaseModel):
    id: UUID
    author_id: UUID
    author_name: str
    kind: str
    note: str
    media_id: Optional[UUID] = None
    remaining_work: Optional[str] = None
    resources_used: Optional[str] = None
    created_at: datetime


class DispatchCompletionIn(BaseModel):
    completion_note: str = Field(min_length=1, max_length=4000)
    remaining_work: Optional[str] = Field(default=None, max_length=2000)
    resources_used: Optional[str] = Field(default=None, max_length=2000)
    media_id: Optional[UUID] = None


class FieldOfficerSupportRequestIn(BaseModel):
    support_type: Literal["medical", "rescue", "logistics", "general"] = "general"
    volunteers_needed: int = Field(default=1, ge=1, le=25)
    details: str = Field(min_length=5, max_length=2000)
    location: Optional[str] = Field(default=None, max_length=1000)


class FieldOfficerSupportAssignmentIn(BaseModel):
    volunteer_ids: list[UUID] = Field(min_length=1, max_length=25)


class FieldOfficerSupportVolunteerOut(BaseModel):
    dispatch_id: UUID
    name: str
    status: str


class FieldOfficerSupportMessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class FieldOfficerSupportMessageOut(BaseModel):
    id: UUID
    author_id: UUID
    author_name: str
    author_role: str
    message: str
    created_at: datetime


class FieldOfficerSupportRequestOut(BaseModel):
    id: UUID
    dispatch_id: UUID
    requested_by: UUID
    officer_name: str
    support_type: str
    details: str
    location: Optional[str] = None
    volunteers_needed: int
    volunteers_assigned: int = 0
    volunteers: list[FieldOfficerSupportVolunteerOut] = Field(default_factory=list)
    messages: list[FieldOfficerSupportMessageOut] = Field(default_factory=list)
    status: str
    created_at: datetime


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
    completion_acknowledged_at: Optional[datetime] = None
    shift_starts_at: Optional[datetime] = None
    shift_ends_at: Optional[datetime] = None
    checked_in_at: Optional[datetime] = None
    checked_out_at: Optional[datetime] = None
    meeting_point: Optional[str] = None
    instructions: Optional[str] = None
    due_at: Optional[datetime] = None
    updates: list[DispatchUpdateOut] = Field(default_factory=list)
    support_requests: list[FieldOfficerSupportRequestOut] = Field(default_factory=list)
    support_request_id: Optional[UUID] = None
    support_request_messages: list[FieldOfficerSupportMessageOut] = Field(default_factory=list)
    priority_score: Optional[float] = None
    lat: Optional[float] = None
    lon: Optional[float] = None


class DispatchStatusIn(BaseModel):
    status: Literal["acknowledged", "en_route", "arrived", "needs_help"]


class VolunteerCompletionIn(BaseModel):
    completion_note: str = Field(min_length=1, max_length=2000)


class VolunteerProfileUpdate(BaseModel):
    available: bool
    skills: Optional[str] = Field(default=None, max_length=2000)
    languages: Optional[str] = Field(default=None, max_length=1000)
    has_transport: bool = False


class VolunteerProfileOut(BaseModel):
    id: UUID
    name: str
    phone: str
    available: bool
    skills: Optional[str]
    languages: Optional[str]
    has_transport: bool


class VolunteerLocationUpdate(BaseModel):
    dispatch_id: UUID
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class VolunteerLocationOut(BaseModel):
    volunteer_id: UUID
    volunteer_name: str
    dispatch_id: UUID
    task_group_id: Optional[UUID] = None
    task: str
    status: str
    lat: float
    lon: float
    updated_at: datetime


class VolunteerSOSCreate(BaseModel):
    message: Optional[str] = Field(default=None, max_length=1000)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lon: Optional[float] = Field(default=None, ge=-180, le=180)
    accuracy_m: Optional[float] = Field(default=None, ge=0, le=100000)


class VolunteerSafetyEventOut(BaseModel):
    id: str
    event_type: str
    volunteer_id: UUID
    volunteer_name: str
    phone: str
    dispatch_id: UUID
    task: str
    message: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    location_source: str = "unavailable"
    accuracy_m: Optional[float] = None
    created_at: datetime
    shift_starts_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
