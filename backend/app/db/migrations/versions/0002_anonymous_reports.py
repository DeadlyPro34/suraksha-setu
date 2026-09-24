"""allow citizen reports before authentication is available

Revision ID: 0002_anonymous_reports
Revises: 0001_initial
Create Date: 2026-09-24

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0002_anonymous_reports"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "reports",
        "reporter_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )


def downgrade() -> None:
    # This will fail if anonymous reports exist; assign them to a real user
    # before rolling this migration back.
    op.alter_column(
        "reports",
        "reporter_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )
