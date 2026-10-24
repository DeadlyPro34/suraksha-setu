import re
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.user import UserRole


class SignupIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=10, max_length=10)
    password: str = Field(min_length=8, max_length=72)
    role: UserRole = UserRole.citizen
    invite_code: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_maximum_utf8_length(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        value = value.strip()
        if not re.fullmatch(r"[0-9]{10}", value):
            raise ValueError("Phone number must contain exactly 10 digits")
        return value


class LoginIn(BaseModel):
    phone: str = Field(min_length=10, max_length=10)
    password: str

    @field_validator("phone")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        value = value.strip()
        if not re.fullmatch(r"[0-9]{10}", value):
            raise ValueError("Phone number must contain exactly 10 digits")
        return value


class UserOut(BaseModel):
    id: UUID
    name: str
    phone: str
    role: UserRole


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
