"""add volunteer profiles, task details, progress states, and opt-in locations

Revision ID: 0010_volunteer_coordination
Revises: 0009_volunteer_done_notes
Create Date: 2026-10-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "0010_volunteer_coordination"
down_revision: Union[str, None] = "0009_volunteer_done_notes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("volunteer_available", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("volunteer_skills", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("volunteer_languages", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("volunteer_has_transport", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("dispatches", sa.Column("shift_starts_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("dispatches", sa.Column("shift_ends_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("dispatches", sa.Column("meeting_point", sa.Text(), nullable=True))
    op.execute("ALTER TYPE dispatch_status ADD VALUE 'en_route'")
    op.execute("ALTER TYPE dispatch_status ADD VALUE 'arrived'")
    op.execute("ALTER TYPE dispatch_status ADD VALUE 'needs_help'")
    op.create_table(
        "volunteer_locations",
        sa.Column("volunteer_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("dispatch_id", UUID(as_uuid=True), sa.ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("volunteer_locations")
    op.drop_column("dispatches", "meeting_point")
    op.drop_column("dispatches", "shift_ends_at")
    op.drop_column("dispatches", "shift_starts_at")
    op.drop_column("users", "volunteer_has_transport")
    op.drop_column("users", "volunteer_languages")
    op.drop_column("users", "volunteer_skills")
    op.drop_column("users", "volunteer_available")
    op.execute("UPDATE dispatches SET status = 'acknowledged' WHERE status::text IN ('en_route', 'arrived', 'needs_help')")
    op.execute("ALTER TYPE dispatch_status RENAME TO dispatch_status_old")
    op.execute("CREATE TYPE dispatch_status AS ENUM ('pending', 'sent', 'acknowledged', 'completed')")
    op.execute("ALTER TABLE dispatches ALTER COLUMN status TYPE dispatch_status USING status::text::dispatch_status")
    op.execute("DROP TYPE dispatch_status_old")
