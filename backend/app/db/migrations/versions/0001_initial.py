"""create all initial tables

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
# pyrefly: ignore [missing-import]
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Enable PostGIS extension ---
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # ------------------------------------------------------------------
    # 1. users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("phone", sa.String, unique=True, nullable=False),
        sa.Column("email", sa.String, nullable=True),
        sa.Column(
            "role",
            sa.Enum(
                "citizen", "field_officer", "volunteer", "official", "admin",
                name="user_role",
            ),
            nullable=False,
        ),
        sa.Column("password_hash", sa.String, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ------------------------------------------------------------------
    # 2. reports
    # ------------------------------------------------------------------
    op.create_table(
        "reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("reporter_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "type",
            sa.Enum("flood", "road_block", "medical", "other", name="report_type"),
            nullable=False,
        ),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("location", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("image_url", sa.String, nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "pending_verification", "verified", "rejected",
                name="report_status",
            ),
            nullable=False,
            server_default="pending_verification",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ------------------------------------------------------------------
    # 3. verifications
    # ------------------------------------------------------------------
    op.create_table(
        "verifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "report_id",
            UUID(as_uuid=True),
            sa.ForeignKey("reports.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "result",
            sa.Enum("verified", "rejected", "uncertain", name="verification_result"),
            nullable=False,
        ),
        sa.Column("credibility_score", sa.Float, nullable=True),
        sa.Column("image_reuse_flag", sa.Boolean, server_default="false", nullable=False),
        sa.Column("timestamp_mismatch_flag", sa.Boolean, server_default="false", nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # 4. incidents
    # ------------------------------------------------------------------
    op.create_table(
        "incidents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "report_id",
            UUID(as_uuid=True),
            sa.ForeignKey("reports.id"),
            nullable=True,
            unique=True,
        ),
        sa.Column("location", Geometry("POINT", srid=4326), nullable=False),
        sa.Column(
            "severity",
            sa.Enum("low", "medium", "high", "critical", name="incident_severity"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("open", "in_progress", "resolved", name="incident_status"),
            nullable=False,
            server_default="open",
        ),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
    )

    # ------------------------------------------------------------------
    # 5. shelters
    # ------------------------------------------------------------------
    op.create_table(
        "shelters",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("location", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("capacity", sa.Integer, nullable=False),
        sa.Column("current_occupancy", sa.Integer, server_default="0", nullable=False),
        sa.Column("has_electricity", sa.Boolean, nullable=False),
        sa.Column("has_medical", sa.Boolean, nullable=False),
        sa.Column(
            "status",
            sa.Enum("open", "full", "closed", name="shelter_status"),
            nullable=False,
            server_default="open",
        ),
    )

    # ------------------------------------------------------------------
    # 6. resources
    # ------------------------------------------------------------------
    op.create_table(
        "resources",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "incident_id",
            UUID(as_uuid=True),
            sa.ForeignKey("incidents.id"),
            nullable=True,
        ),
        sa.Column(
            "type",
            sa.Enum("medical", "food", "water", "boat", "personnel", name="resource_type"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("location", Geometry("POINT", srid=4326), nullable=True),
        sa.Column(
            "status",
            sa.Enum("available", "allocated", "depleted", name="resource_status"),
            nullable=False,
            server_default="available",
        ),
    )

    # ------------------------------------------------------------------
    # 7. routes
    # ------------------------------------------------------------------
    op.create_table(
        "routes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("start_location", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("end_location", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("distance_km", sa.Float, nullable=True),
        sa.Column(
            "status",
            sa.Enum("clear", "partial", "blocked", "unknown", name="route_status"),
            nullable=False,
            server_default="unknown",
        ),
        sa.Column("last_checked", sa.DateTime(timezone=True), nullable=False),
    )

    # ------------------------------------------------------------------
    # 8. response_plans
    # ------------------------------------------------------------------
    op.create_table(
        "response_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "incident_id",
            UUID(as_uuid=True),
            sa.ForeignKey("incidents.id"),
            nullable=False,
        ),
        sa.Column("priority_score", sa.Float, nullable=False),
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending_approval", "approved", "rejected", "modified",
                name="plan_status",
            ),
            nullable=False,
            server_default="pending_approval",
        ),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ------------------------------------------------------------------
    # 9. approvals
    # ------------------------------------------------------------------
    op.create_table(
        "approvals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "response_plan_id",
            UUID(as_uuid=True),
            sa.ForeignKey("response_plans.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "approved_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "decision",
            sa.Enum("approved", "rejected", "modified", name="approval_decision"),
            nullable=False,
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ------------------------------------------------------------------
    # 10. alerts
    # ------------------------------------------------------------------
    op.create_table(
        "alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "incident_id",
            UUID(as_uuid=True),
            sa.ForeignKey("incidents.id"),
            nullable=False,
        ),
        sa.Column(
            "type",
            sa.Enum("evacuation", "warning", "resupply", "all_clear", name="alert_type"),
            nullable=False,
        ),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("language", sa.String, server_default="en", nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("alerts")
    op.drop_table("approvals")
    op.drop_table("response_plans")
    op.drop_table("routes")
    op.drop_table("resources")
    op.drop_table("shelters")
    op.drop_table("incidents")
    op.drop_table("verifications")
    op.drop_table("reports")
    op.drop_table("users")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS alert_type")
    op.execute("DROP TYPE IF EXISTS approval_decision")
    op.execute("DROP TYPE IF EXISTS plan_status")
    op.execute("DROP TYPE IF EXISTS route_status")
    op.execute("DROP TYPE IF EXISTS resource_status")
    op.execute("DROP TYPE IF EXISTS resource_type")
    op.execute("DROP TYPE IF EXISTS shelter_status")
    op.execute("DROP TYPE IF EXISTS incident_status")
    op.execute("DROP TYPE IF EXISTS incident_severity")
    op.execute("DROP TYPE IF EXISTS verification_result")
    op.execute("DROP TYPE IF EXISTS report_status")
    op.execute("DROP TYPE IF EXISTS report_type")
    op.execute("DROP TYPE IF EXISTS user_role")
