"""Track when shelter availability was last confirmed."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0023_shelter_freshness"
down_revision: Union[str, None] = "0022_alert_expiry"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("shelters", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    # Leave existing rows NULL: their original confirmation time is unknown.
    op.alter_column("shelters", "updated_at", server_default=sa.func.now())


def downgrade() -> None:
    op.drop_column("shelters", "updated_at")
