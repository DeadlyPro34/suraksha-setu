from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.user import UserRole


class SignupIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=72)
    role: UserRole = UserRole.citizen
    invite_code: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_maximum_utf8_length(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value


class LoginIn(BaseModel):
    phone: str
    password: str


class UserOut(BaseModel):
    id: UUID
    name: str
    phone: str
    role: UserRole


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
