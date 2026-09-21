"""User model."""

import enum

from sqlalchemy import Column, String, Enum
from sqlalchemy.orm import relationship

from .base import Base, pk_uuid, created_at_col


class UserRole(str, enum.Enum):
    citizen = "citizen"
    field_officer = "field_officer"
    volunteer = "volunteer"
    official = "official"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = pk_uuid()
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=True)
    role = Column(Enum(UserRole, name="user_role"), nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = created_at_col()

    # --- relationships ---
    reports = relationship("Report", back_populates="reporter")
    approvals = relationship("Approval", back_populates="approver")
