"""Track field supply requests through delivery and receipt."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0018_supply_requests"
down_revision: Union[str, None] = "0017_support_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supply_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_role", sa.String(length=24), nullable=False),
        sa.Column("resource_type", sa.String(length=32), nullable=False),
        sa.Column("requested_quantity", sa.Integer(), nullable=False),
        sa.Column("approved_quantity", sa.Integer(), nullable=True),
        sa.Column("location_name", sa.String(length=200), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=24), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("delivery_handler", sa.String(length=200), nullable=True),
        sa.Column("dispatch_note", sa.Text(), nullable=True),
        sa.Column("dispatched_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_quantity", sa.Integer(), nullable=True),
        sa.Column("receipt_note", sa.Text(), nullable=True),
        sa.Column("receipt_status", sa.String(length=32), server_default="awaiting_confirmation", nullable=False),
        sa.Column("received_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("official_close_note", sa.Text(), nullable=True),
        sa.Column("closed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("requested_quantity > 0", name="ck_supply_requests_requested_positive"),
        sa.CheckConstraint("approved_quantity IS NULL OR (approved_quantity > 0 AND approved_quantity <= requested_quantity)", name="ck_supply_requests_approved_quantity"),
        sa.CheckConstraint("received_quantity IS NULL OR received_quantity >= 0", name="ck_supply_requests_received_nonnegative"),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected', 'dispatched', 'delivery_issue', 'delivered')", name="ck_supply_requests_status"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["dispatched_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["received_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["closed_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_supply_requests_requester_id", "supply_requests", ["requester_id"])
    op.create_index("ix_supply_requests_status", "supply_requests", ["status"])
    op.create_index("ix_supply_requests_created_at", "supply_requests", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_supply_requests_created_at", table_name="supply_requests")
    op.drop_index("ix_supply_requests_status", table_name="supply_requests")
    op.drop_index("ix_supply_requests_requester_id", table_name="supply_requests")
    op.drop_table("supply_requests")
