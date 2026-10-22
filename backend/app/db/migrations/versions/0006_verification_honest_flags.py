"""allow verification flags to represent checks that were not performed

Revision ID: 0006_verification_honest_flags
Revises: 0005_remove_admin_user_role
Create Date: 2026-10-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_verification_honest_flags"
down_revision: Union[str, None] = "0005_remove_admin_user_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "verifications",
        "image_reuse_flag",
        existing_type=sa.Boolean(),
        existing_server_default=sa.text("false"),
        server_default=None,
        nullable=True,
    )
    op.alter_column(
        "verifications",
        "timestamp_mismatch_flag",
        existing_type=sa.Boolean(),
        existing_server_default=sa.text("false"),
        server_default=None,
        nullable=True,
    )
    op.add_column(
        "verifications",
        sa.Column("geolocation_mismatch_flag", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.execute(
        "UPDATE verifications SET image_reuse_flag = COALESCE(image_reuse_flag, false), "
        "timestamp_mismatch_flag = COALESCE(timestamp_mismatch_flag, false)"
    )
    op.drop_column("verifications", "geolocation_mismatch_flag")
    op.alter_column(
        "verifications",
        "image_reuse_flag",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.text("false"),
    )
    op.alter_column(
        "verifications",
        "timestamp_mismatch_flag",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.text("false"),
    )
