"""Record the source and accuracy of volunteer SOS coordinates."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0012_sos_location_accuracy"
down_revision: Union[str, None] = "0011_volunteer_safety"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("volunteer_safety_events", sa.Column("location_source", sa.String(length=24), nullable=False, server_default="task_area"))
    op.add_column("volunteer_safety_events", sa.Column("accuracy_m", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("volunteer_safety_events", "accuracy_m")
    op.drop_column("volunteer_safety_events", "location_source")
