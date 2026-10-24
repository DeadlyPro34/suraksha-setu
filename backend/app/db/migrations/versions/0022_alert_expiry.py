"""Add an explicit public visibility window to alerts."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0022_alert_expiry"
down_revision: Union[str, None] = "0021_dispatch_source_stock"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column("alerts", sa.Column("active_until", sa.DateTime(timezone=True), nullable=True))
    # Undated legacy alerts are expired during migration instead of being
    # treated as current public guidance indefinitely.
    op.execute(sa.text("""
        UPDATE alerts
        SET active_until = CASE
            WHEN sent_at IS NULL THEN now()
            WHEN type = 'evacuation' THEN sent_at + interval '24 hours'
            WHEN type = 'warning' THEN sent_at + interval '12 hours'
            WHEN type = 'resupply' THEN sent_at + interval '24 hours'
            ELSE sent_at + interval '72 hours'
        END
        WHERE active_until IS NULL
    """))


def downgrade() -> None:
    op.drop_column("alerts", "active_until")
