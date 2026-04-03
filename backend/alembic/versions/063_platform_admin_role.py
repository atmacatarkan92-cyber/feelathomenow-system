"""Allow users.role = platform_admin (Vantio platform operators).

Revision ID: 063_platform_admin_role
Revises: 062_organization_slug
"""

from typing import Sequence, Union

from sqlalchemy import text

from alembic import op

revision: str = "063_platform_admin_role"
down_revision: Union[str, None] = "062_organization_slug"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CHECK_NAME = "users_role_allowed"

_ALLOWED = (
    "'admin', 'manager', 'landlord', 'tenant', 'support', 'platform_admin'"
)


def upgrade() -> None:
    op.drop_constraint(CHECK_NAME, "users", type_="check")
    op.create_check_constraint(
        CHECK_NAME,
        "users",
        f"role::text IN ({_ALLOWED})",
    )


def downgrade() -> None:
    op.execute(text(f"ALTER TABLE users DROP CONSTRAINT IF EXISTS {CHECK_NAME}"))
    op.create_check_constraint(
        CHECK_NAME,
        "users",
        "role::text IN ('admin', 'manager', 'landlord', 'tenant', 'support')",
    )
