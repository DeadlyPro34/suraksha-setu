"""Let officials acknowledge volunteer completion reports."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0013_volunteer_report_ack"
down_revision: Union[str, None] = "0012_sos_location_accuracy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "dispatches",
        sa.Column("completion_acknowledged_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("dispatches", "completion_acknowledged_at")
