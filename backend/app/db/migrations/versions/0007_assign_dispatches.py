"""assign dispatches to individual field officers

Revision ID: 0007_assign_dispatches
Revises: 0006_verification_honest_flags
Create Date: 2026-10-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "0007_assign_dispatches"
down_revision: Union[str, None] = "0006_verification_honest_flags"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("dispatches", sa.Column("assigned_to", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_dispatches_assigned_to_users",
        "dispatches",
        "users",
        ["assigned_to"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_dispatches_assigned_to_users", "dispatches", type_="foreignkey")
    op.drop_column("dispatches", "assigned_to")
