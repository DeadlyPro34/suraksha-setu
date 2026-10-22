"""Add volunteer shift check-in and SOS events."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "0011_volunteer_safety"
down_revision: Union[str, None] = "0010_volunteer_coordination"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("dispatches", sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("dispatches", sa.Column("checked_out_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("dispatches", sa.Column("missed_checkin_acknowledged_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "volunteer_safety_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("volunteer_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dispatch_id", UUID(as_uuid=True), sa.ForeignKey("dispatches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False, server_default="sos"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_volunteer_safety_events_volunteer_id", "volunteer_safety_events", ["volunteer_id"])
    op.create_index("ix_volunteer_safety_events_dispatch_id", "volunteer_safety_events", ["dispatch_id"])


def downgrade() -> None:
    op.drop_index("ix_volunteer_safety_events_dispatch_id", table_name="volunteer_safety_events")
    op.drop_index("ix_volunteer_safety_events_volunteer_id", table_name="volunteer_safety_events")
    op.drop_table("volunteer_safety_events")
    op.drop_column("dispatches", "missed_checkin_acknowledged_at")
    op.drop_column("dispatches", "checked_out_at")
    op.drop_column("dispatches", "checked_in_at")
