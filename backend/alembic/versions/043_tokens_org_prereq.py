"""Prerequisite: organization_id on user_credentials and refresh_tokens (nullable, no RLS).

Revision ID: 043_tokens_org_prereq
Revises: 042_rls_users_audit_logs

- Add nullable organization_id matching public.organization.id type (CI vs production drift).
- Backfill from users via user_id.
- Validate rows that should have been backfilled (see inline SQL); do not enforce NOT NULL yet.
- Add FK + indexes. No RLS in this migration.
"""

import re
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "043_tokens_org_prereq"
down_revision: Union[str, None] = "042_rls_users_audit_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _pg_column_format_type(conn, relname: str, attname: str) -> tuple[int, int, str] | None:
    """Return (atttypid, atttypmod, format_type) or None if column missing."""
    row = conn.execute(
        text(
            """
            SELECT a.atttypid, a.atttypmod,
                   pg_catalog.format_type(a.atttypid, a.atttypmod)
            FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = :relname
              AND a.attname = :attname AND a.attnum > 0 AND NOT a.attisdropped
            """
        ),
        {"relname": relname, "attname": attname},
    ).fetchone()
    if not row:
        return None
    typid, typmod, fmt = int(row[0]), int(row[1]), str(row[2])
    return typid, typmod, fmt


def _validate_type_sql_fragment(s: str) -> str:
    s = str(s).strip()
    if not re.match(r"^[a-zA-Z0-9\s\(\)]+$", s):
        raise RuntimeError(f"043: refusing unsafe organization.id type fragment: {s!r}")
    return s


def _using_expr_for_type_change(org_type_sql: str, child_type_sql: str) -> str:
    """Expression for ALTER ... TYPE ... USING when child column must match organization.id."""
    ol = org_type_sql.lower()
    cl = child_type_sql.lower()
    if "uuid" in ol and "uuid" not in cl:
        return "organization_id::uuid"
    if "uuid" in cl and "uuid" not in ol:
        return "organization_id::text"
    return "organization_id::text"


def _ensure_column_matches_org(
    conn,
    table: str,
    org_typid: int,
    org_typmod: int,
    org_type_sql: str,
) -> None:
    attr = _pg_column_format_type(conn, table, "organization_id")
    if attr is None:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN organization_id {org_type_sql}"))
        return
    ch_typid, ch_typmod, ch_type_sql = attr[0], attr[1], attr[2]
    if (ch_typid, ch_typmod) != (org_typid, org_typmod):
        using = _using_expr_for_type_change(org_type_sql, ch_type_sql)
        conn.execute(
            text(
                f"ALTER TABLE {table} ALTER COLUMN organization_id TYPE {org_type_sql} "
                f"USING ({using})"
            )
        )


def _validate_backfill_nulls(conn, table: str) -> None:
    """Fail if NULL remains where it should have been filled (orphan user_id or failed join)."""
    n = conn.execute(
        text(
            f"""
            SELECT COUNT(*) FROM {table} c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.organization_id IS NULL
              AND (u.id IS NULL OR u.organization_id IS NOT NULL)
            """
        )
    ).scalar()
    if n and int(n) > 0:
        raise RuntimeError(
            f"043: {table}.organization_id backfill incomplete or inconsistent "
            f"({n} rows: orphan user_id or user had org but column still NULL)"
        )


def upgrade() -> None:
    conn = op.get_bind()

    org_attr = _pg_column_format_type(conn, "organization", "id")
    if not org_attr:
        raise RuntimeError("043: public.organization.id not found")
    org_typid, org_typmod, org_type_sql = org_attr[0], org_attr[1], _validate_type_sql_fragment(org_attr[2])

    _ensure_column_matches_org(conn, "user_credentials", org_typid, org_typmod, org_type_sql)
    conn.execute(
        text(
            """
            UPDATE user_credentials c
            SET organization_id = u.organization_id
            FROM users u
            WHERE c.user_id = u.id
            """
        )
    )
    _validate_backfill_nulls(conn, "user_credentials")

    _ensure_column_matches_org(conn, "refresh_tokens", org_typid, org_typmod, org_type_sql)
    conn.execute(
        text(
            """
            UPDATE refresh_tokens r
            SET organization_id = u.organization_id
            FROM users u
            WHERE r.user_id = u.id
            """
        )
    )
    _validate_backfill_nulls(conn, "refresh_tokens")

    op.create_foreign_key(
        "user_credentials_organization_id_fkey",
        "user_credentials",
        "organization",
        ["organization_id"],
        ["id"],
    )
    op.create_index("ix_user_credentials_organization_id", "user_credentials", ["organization_id"])

    op.create_foreign_key(
        "refresh_tokens_organization_id_fkey",
        "refresh_tokens",
        "organization",
        ["organization_id"],
        ["id"],
    )
    op.create_index("ix_refresh_tokens_organization_id", "refresh_tokens", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_organization_id", table_name="refresh_tokens")
    op.drop_constraint("refresh_tokens_organization_id_fkey", "refresh_tokens", type_="foreignkey")
    op.drop_column("refresh_tokens", "organization_id")

    op.drop_index("ix_user_credentials_organization_id", table_name="user_credentials")
    op.drop_constraint("user_credentials_organization_id_fkey", "user_credentials", type_="foreignkey")
    op.drop_column("user_credentials", "organization_id")
