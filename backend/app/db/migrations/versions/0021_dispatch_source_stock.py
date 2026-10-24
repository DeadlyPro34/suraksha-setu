"""Record and deduct the stock location supplying each dispatch."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0021_dispatch_source_stock"
down_revision: Union[str, None] = "0020_receipt_review"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "supply_requests",
        sa.Column("stock_source_resource_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_supply_requests_stock_source_resource_id_resources",
        "supply_requests",
        "resources",
        ["stock_source_resource_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_supply_requests_stock_source_resource_id_resources",
        "supply_requests",
        type_="foreignkey",
    )
    op.drop_column("supply_requests", "stock_source_resource_id")
