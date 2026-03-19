"""Users: organization_id + per-organization unique email (case-insensitive).

Revision ID: 018_users_org
Revises: 017_operational_nonneg
Create Date: 2026-03-14

- Add users.organization_id (FK organization), backfill from first organization by created_at.
- Replace global unique(users.email) with unique (organization_id, lower(email)).
- Non-unique index on organization_id for listings.

Downgrade restores global unique email only; fails if duplicate emails exist across organizations.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "018_users_org"
down_revision: Union[str, None] = "017_operational_nonneg"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    op.add_column("users", sa.Column("organization_id", sa.String(), nullable=True))
    op.create_foreign_key(
        "users_organization_id_fkey",
        "users",
        "organization",
        ["organization_id"],
        ["id"],
    )

    conn.execute(
        text("""
            UPDATE users
            SET organization_id = (
                SELECT id FROM organization ORDER BY created_at ASC NULLS LAST LIMIT 1
            )
            WHERE organization_id IS NULL
        """)
    )

    still_null = conn.execute(text("SELECT COUNT(*) FROM users WHERE organization_id IS NULL")).scalar()
    if still_null and int(still_null) > 0:
        raise RuntimeError(
            "Migration 018 blocked: users.organization_id could not be backfilled "
            "(no organization row). Create an organization first, then re-run."
        )

    op.alter_column("users", "organization_id", existing_type=sa.String(), nullable=False)

    op.drop_index("ix_users_email", table_name="users")

    conn.execute(
        text(
            "CREATE UNIQUE INDEX uq_users_organization_email_lower "
            "ON users (organization_id, (lower(email)))"
        )
    )
    op.create_index("ix_users_organization_id", "users", ["organization_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_organization_id", table_name="users")
    op.execute(text("DROP INDEX IF EXISTS uq_users_organization_email_lower"))
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.drop_constraint("users_organization_id_fkey", "users", type_="foreignkey")
    op.drop_column("users", "organization_id")
