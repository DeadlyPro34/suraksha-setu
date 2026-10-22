"""support official volunteer task assignment and crew sizes

Revision ID: 0008_volunteer_task_groups
Revises: 0007_assign_dispatches
Create Date: 2026-10-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "0008_volunteer_task_groups"
down_revision: Union[str, None] = "0007_assign_dispatches"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("dispatches", sa.Column("task_group_id", UUID(as_uuid=True), nullable=True))
    op.add_column("dispatches", sa.Column("volunteers_needed", sa.Integer(), nullable=False, server_default="1"))
    op.create_index("ix_dispatches_task_group_id", "dispatches", ["task_group_id"])


def downgrade() -> None:
    op.drop_index("ix_dispatches_task_group_id", table_name="dispatches")
    op.drop_column("dispatches", "volunteers_needed")
    op.drop_column("dispatches", "task_group_id")
