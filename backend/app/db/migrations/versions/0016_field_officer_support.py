"""Add officer-requested volunteer support."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0016_field_officer_support"
down_revision: Union[str, None] = "0015_field_officer_updates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "field_officer_support_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dispatch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("support_type", sa.String(length=32), server_default="general", nullable=False),
        sa.Column("volunteers_needed", sa.Integer(), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=24), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["dispatch_id"], ["dispatches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("volunteers_needed BETWEEN 1 AND 25", name="ck_field_officer_support_count"),
        sa.CheckConstraint("support_type IN ('medical', 'rescue', 'logistics', 'general')", name="ck_field_officer_support_type"),
        sa.CheckConstraint("status IN ('pending', 'assigned', 'completed', 'cancelled')", name="ck_field_officer_support_status"),
    )
    op.create_index("ix_field_officer_support_requests_dispatch_id", "field_officer_support_requests", ["dispatch_id"])
    op.create_index("ix_field_officer_support_requests_requested_by", "field_officer_support_requests", ["requested_by"])
    op.add_column("dispatches", sa.Column("support_request_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_dispatches_support_request_id_field_officer_support_requests",
        "dispatches", "field_officer_support_requests", ["support_request_id"], ["id"], ondelete="SET NULL",
    )
    op.create_index("ix_dispatches_support_request_id", "dispatches", ["support_request_id"])


def downgrade() -> None:
    op.drop_index("ix_dispatches_support_request_id", table_name="dispatches")
    op.drop_constraint("fk_dispatches_support_request_id_field_officer_support_requests", "dispatches", type_="foreignkey")
    op.drop_column("dispatches", "support_request_id")
    op.drop_index("ix_field_officer_support_requests_requested_by", table_name="field_officer_support_requests")
    op.drop_index("ix_field_officer_support_requests_dispatch_id", table_name="field_officer_support_requests")
    op.drop_table("field_officer_support_requests")
