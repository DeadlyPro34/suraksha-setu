"""Track the quantity actually dispatched for an approved supply request."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0024_partial_supply_dispatch"
down_revision: Union[str, None] = "0023_shelter_freshness"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("supply_requests", sa.Column("dispatched_quantity", sa.Integer(), nullable=True))
    # Existing dispatched/closed requests consumed their approved quantity.
    op.execute(sa.text(
        "UPDATE supply_requests SET dispatched_quantity = approved_quantity "
        "WHERE status IN ('dispatched', 'receipt_submitted', 'delivery_issue', 'delivered')"
    ))


def downgrade() -> None:
    op.drop_column("supply_requests", "dispatched_quantity")
