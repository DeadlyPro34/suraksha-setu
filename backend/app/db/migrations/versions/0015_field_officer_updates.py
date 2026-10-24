"""Add field assignment instructions and update timeline."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0015_field_officer_updates"
down_revision: Union[str, None] = "0014_resource_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column("dispatches", sa.Column("instructions", sa.Text(), nullable=True))
    op.add_column("dispatches", sa.Column("due_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "dispatch_updates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dispatch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("media_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("remaining_work", sa.Text(), nullable=True),
        sa.Column("resources_used", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["dispatch_id"], ["dispatches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dispatch_updates_dispatch_id", "dispatch_updates", ["dispatch_id"])

def downgrade() -> None:
    op.drop_index("ix_dispatch_updates_dispatch_id", table_name="dispatch_updates")
    op.drop_table("dispatch_updates")
    op.drop_column("dispatches", "due_at")
    op.drop_column("dispatches", "instructions")
