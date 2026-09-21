"""Declarative base for all SQLAlchemy models."""

import uuid
from sqlalchemy import Column, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared base class with no default columns.

    Individual models add their own ``id`` and timestamp columns so we
    keep the base as slim as possible.
    """
    pass


def pk_uuid():
    """Return a standard UUID primary-key column."""
    return Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def created_at_col():
    """Return a ``created_at`` column that defaults to now()."""
    return Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
