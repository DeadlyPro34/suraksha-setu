"""Add resource stock reports and official review."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0014_resource_reports"
down_revision: Union[str, None] = "0013_volunteer_report_ack"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("resources", sa.Column("location_name", sa.String(length=200), server_default="Regional stock", nullable=False))
    op.create_table(
        "resource_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("resource_type", sa.String(length=32), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("location_name", sa.String(length=200), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("submitted_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["submitted_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("quantity >= 0", name="ck_resource_reports_quantity_nonnegative"),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_resource_reports_status"),
    )
    op.create_index("ix_resource_reports_submitted_by", "resource_reports", ["submitted_by"])
    op.create_index("ix_resource_reports_status_submitted_at", "resource_reports", ["status", "submitted_at"])


def downgrade() -> None:
    op.drop_index("ix_resource_reports_status_submitted_at", table_name="resource_reports")
    op.drop_index("ix_resource_reports_submitted_by", table_name="resource_reports")
    op.drop_table("resource_reports")
    op.drop_column("resources", "location_name")
