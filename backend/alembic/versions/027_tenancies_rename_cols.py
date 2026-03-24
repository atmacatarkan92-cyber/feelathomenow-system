"""Tenancies: rename rent_chf→monthly_rent and deposit_chf→deposit_amount.

Revision ID: 027_tenancies_rename_cols
Revises: 026_tenancies_no_overlap

Why:
  - Alembic 001 creates tenancies.rent_chf and tenancies.deposit_chf.
  - Production and application models use monthly_rent and deposit_amount.
  - CI (upgrade from empty DB) therefore exposes the old names unless we align them here.

Behavior:
  - If the new column already exists, skip (production already migrated manually).
  - If only the old column exists, rename in place (no table recreate, no data loss).
  - If both old and new exist for the same logical field, fail fast (ambiguous drift).

Idempotent: re-running upgrade() after a successful rename is a no-op.

Downgrade() reverses renames only when the target old name is absent and the new name is present.
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "027_tenancies_rename_cols"
down_revision: Union[str, None] = "026_tenancies_no_overlap"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "tenancies"
SCHEMA = "public"


def _column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = :t AND column_name = :c
            LIMIT 1
            """
        ),
        {"schema": SCHEMA, "t": table, "c": column},
    )
    return result.fetchone() is not None


def _table_exists(conn, table: str) -> bool:
    result = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = :schema AND table_name = :t
            LIMIT 1
            """
        ),
        {"schema": SCHEMA, "t": table},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, TABLE):
        return

    has_rent_old = _column_exists(conn, TABLE, "rent_chf")
    has_rent_new = _column_exists(conn, TABLE, "monthly_rent")
    has_dep_old = _column_exists(conn, TABLE, "deposit_chf")
    has_dep_new = _column_exists(conn, TABLE, "deposit_amount")

    if has_rent_old and has_rent_new:
        raise RuntimeError(
            f"{TABLE} has both rent_chf and monthly_rent; resolve duplicate columns manually, "
            "then re-run alembic upgrade head."
        )
    if has_dep_old and has_dep_new:
        raise RuntimeError(
            f"{TABLE} has both deposit_chf and deposit_amount; resolve duplicate columns manually, "
            "then re-run alembic upgrade head."
        )

    # Rename only when old exists and new does not (fresh CI path).
    if has_rent_old and not has_rent_new:
        op.execute(
            text(f'ALTER TABLE "{SCHEMA}"."{TABLE}" RENAME COLUMN rent_chf TO monthly_rent')
        )
    if has_dep_old and not has_dep_new:
        op.execute(
            text(f'ALTER TABLE "{SCHEMA}"."{TABLE}" RENAME COLUMN deposit_chf TO deposit_amount')
        )


def downgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, TABLE):
        return

    has_rent_old = _column_exists(conn, TABLE, "rent_chf")
    has_rent_new = _column_exists(conn, TABLE, "monthly_rent")
    has_dep_old = _column_exists(conn, TABLE, "deposit_chf")
    has_dep_new = _column_exists(conn, TABLE, "deposit_amount")

    if has_rent_old and has_rent_new:
        raise RuntimeError(
            f"{TABLE} has both rent_chf and monthly_rent; cannot downgrade safely."
        )
    if has_dep_old and has_dep_new:
        raise RuntimeError(
            f"{TABLE} has both deposit_chf and deposit_amount; cannot downgrade safely."
        )

    if has_rent_new and not has_rent_old:
        op.execute(
            text(f'ALTER TABLE "{SCHEMA}"."{TABLE}" RENAME COLUMN monthly_rent TO rent_chf')
        )
    if has_dep_new and not has_dep_old:
        op.execute(
            text(f'ALTER TABLE "{SCHEMA}"."{TABLE}" RENAME COLUMN deposit_amount TO deposit_chf')
        )
