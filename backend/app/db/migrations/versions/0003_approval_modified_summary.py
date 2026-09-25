"""add modified summary to approvals

Revision ID: 0003_approval_modified_summary
Revises: 0002_anonymous_reports
Create Date: 2026-09-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_approval_modified_summary"
down_revision: Union[str, None] = "0002_anonymous_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column("approvals", sa.Column("modified_summary", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("approvals", "modified_summary")
