"""Require official closure after a recipient submits a delivery receipt."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0020_receipt_review"
down_revision: Union[str, None] = "0019_link_approved_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_supply_requests_status", "supply_requests", type_="check")
    op.create_check_constraint(
        "ck_supply_requests_status",
        "supply_requests",
        "status IN ('pending', 'approved', 'rejected', 'dispatched', 'receipt_submitted', 'delivery_issue', 'delivered')",
    )


def downgrade() -> None:
    op.execute(sa.text("UPDATE supply_requests SET status = 'dispatched' WHERE status = 'receipt_submitted'"))
    op.drop_constraint("ck_supply_requests_status", "supply_requests", type_="check")
    op.create_check_constraint(
        "ck_supply_requests_status",
        "supply_requests",
        "status IN ('pending', 'approved', 'rejected', 'dispatched', 'delivery_issue', 'delivered')",
    )
