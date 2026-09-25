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

    class Config:
        from_attributes = True
