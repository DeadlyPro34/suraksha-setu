"""create simulated action dispatches

Revision ID: 0004_action_dispatches
Revises: 0003_approval_modified_summary
Create Date: 2026-09-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, UUID


revision: str = "0004_action_dispatches"
down_revision: Union[str, None] = "0003_approval_modified_summary"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    target_role = ENUM(
        "field_officer",
        "volunteer",
        "official",
        name="dispatch_target_role",
        create_type=False,
    )
    status = ENUM(
        "pending", "sent", "acknowledged", name="dispatch_status", create_type=False
    )
    op.execute(
        "CREATE TYPE dispatch_target_role AS ENUM ('field_officer', 'volunteer', 'official')"
    )
    op.execute("CREATE TYPE dispatch_status AS ENUM ('pending', 'sent', 'acknowledged')")

    op.create_table(
        "dispatches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "response_plan_id",
            UUID(as_uuid=True),
            sa.ForeignKey("response_plans.id"),
            nullable=False,
        ),
        sa.Column("target_role", target_role, nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("dispatches")
    op.execute("DROP TYPE dispatch_status")
    op.execute("DROP TYPE dispatch_target_role")
