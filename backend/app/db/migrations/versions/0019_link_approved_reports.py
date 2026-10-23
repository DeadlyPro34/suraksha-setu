"""Link approved resource reports to supply delivery tracking."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0019_link_approved_reports"
down_revision: Union[str, None] = "0018_supply_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "supply_requests",
        sa.Column("source_resource_report_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_supply_requests_source_resource_report_id",
        "supply_requests",
        ["source_resource_report_id"],
    )
    op.create_foreign_key(
        "fk_supply_requests_source_resource_report_id_resource_reports",
        "supply_requests",
        "resource_reports",
        ["source_resource_report_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute(sa.text("""
        INSERT INTO supply_requests (
            id, requester_id, requester_role, source_resource_report_id,
            resource_type, requested_quantity, approved_quantity,
            location_name, lat, lon, note, status, created_at,
            reviewed_by, reviewed_at, review_note, receipt_status
        )
        SELECT
            gen_random_uuid(), rr.submitted_by, u.role::text, rr.id,
            rr.resource_type, rr.quantity, rr.quantity,
            rr.location_name, rr.lat, rr.lon, rr.note, 'approved', rr.submitted_at,
            rr.reviewed_by, rr.reviewed_at, rr.review_note, 'awaiting_confirmation'
        FROM resource_reports rr
        JOIN users u ON u.id = rr.submitted_by
        WHERE rr.status = 'approved'
          AND NOT EXISTS (
              SELECT 1 FROM supply_requests sr
              WHERE sr.source_resource_report_id = rr.id
          )
    """))


def downgrade() -> None:
    # Preserve delivery records if this schema link is rolled back.
    op.execute(sa.text("UPDATE supply_requests SET source_resource_report_id = NULL WHERE source_resource_report_id IS NOT NULL"))
    op.drop_constraint(
        "fk_supply_requests_source_resource_report_id_resource_reports",
        "supply_requests",
        type_="foreignkey",
    )
    op.drop_constraint(
        "uq_supply_requests_source_resource_report_id",
        "supply_requests",
        type_="unique",
    )
    op.drop_column("supply_requests", "source_resource_report_id")
