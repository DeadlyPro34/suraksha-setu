"""remove admin user role after promoting existing rows to official

Revision ID: 0005_remove_admin_user_role
Revises: 0004_action_dispatches
Create Date: 2026-09-27
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0005_remove_admin_user_role"
down_revision: Union[str, None] = "0004_action_dispatches"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Preserve access for existing admins under the single official role
    # before the legacy PostgreSQL enum value is removed.
    op.execute("UPDATE users SET role = 'official' WHERE role::text = 'admin'")
    op.execute("ALTER TYPE user_role RENAME TO user_role_old")
    op.execute(
        "CREATE TYPE user_role AS ENUM ('citizen', 'field_officer', 'volunteer', 'official')"
    )
    op.execute(
        "ALTER TABLE users ALTER COLUMN role TYPE user_role "
        "USING role::text::user_role"
    )
    op.execute("DROP TYPE user_role_old")


def downgrade() -> None:
    op.execute("ALTER TYPE user_role RENAME TO user_role_old")
    op.execute(
        "CREATE TYPE user_role AS ENUM ('citizen', 'field_officer', 'volunteer', 'official', 'admin')"
    )
    op.execute(
        "ALTER TABLE users ALTER COLUMN role TYPE user_role "
        "USING role::text::user_role"
    )
    op.execute("DROP TYPE user_role_old")
