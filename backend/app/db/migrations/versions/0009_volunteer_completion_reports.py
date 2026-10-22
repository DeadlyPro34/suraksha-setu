"""let volunteers report task completion with notes

Revision ID: 0009_volunteer_completion_reports
Revises: 0008_volunteer_task_groups
Create Date: 2026-10-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0009_volunteer_done_notes"
down_revision: Union[str, None] = "0008_volunteer_task_groups"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE dispatch_status ADD VALUE 'completed'")
    op.add_column("dispatches", sa.Column("completion_note", sa.Text(), nullable=True))
    op.add_column("dispatches", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("dispatches", "completed_at")
    op.drop_column("dispatches", "completion_note")
    op.execute("UPDATE dispatches SET status = 'acknowledged' WHERE status::text = 'completed'")
    op.execute("ALTER TYPE dispatch_status RENAME TO dispatch_status_old")
    op.execute("CREATE TYPE dispatch_status AS ENUM ('pending', 'sent', 'acknowledged')")
    op.execute(
        "ALTER TABLE dispatches ALTER COLUMN status TYPE dispatch_status "
        "USING status::text::dispatch_status"
    )
    op.execute("DROP TYPE dispatch_status_old")
