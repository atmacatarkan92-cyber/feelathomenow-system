"""RLS: users (org + self-bootstrap + auth lookup) and audit_logs (organization_id).

Revision ID: 042_rls_users_audit_logs
Revises: 041_unit_landlord_lease

- users: ENABLE + FORCE RLS; policy org_isolation_users compares organization_id and
  app.current_organization_id; allows self-row via app.current_user_id; allows password/login
  email matching when app.auth_unscoped_user_lookup = 'true' (SET LOCAL only in trusted auth code).
- audit_logs: add organization_id (FK), backfill from actor user and entity types, NOT NULL,
  ENABLE + FORCE RLS; policy org_isolation_audit_logs matches organization_id to GUC.

See backend/db/rls.py for GUC application.
"""

import re
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "042_rls_users_audit_logs"
down_revision: Union[str, None] = "041_unit_landlord_lease"
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
        raise RuntimeError(f"042: refusing unsafe organization.id type fragment: {s!r}")
    return s


def _using_expr_for_type_change(org_type_sql: str, audit_type_sql: str) -> str:
    """Expression for ALTER ... TYPE ... USING when audit_logs.organization_id must match organization.id."""
    ol = org_type_sql.lower()
    al = audit_type_sql.lower()
    if "uuid" in ol and "uuid" not in al:
        return "organization_id::uuid"
    if "uuid" in al and "uuid" not in ol:
        return "organization_id::text"
    return "organization_id::text"


def upgrade() -> None:
    conn = op.get_bind()

    # --- audit_logs.organization_id: exact same PostgreSQL type as organization.id (CI vs Render drift) ---
    org_attr = _pg_column_format_type(conn, "organization", "id")
    if not org_attr:
        raise RuntimeError("042: public.organization.id not found")
    org_typid, org_typmod, org_type_sql = org_attr[0], org_attr[1], _validate_type_sql_fragment(org_attr[2])

    audit_attr = _pg_column_format_type(conn, "audit_logs", "organization_id")
    if audit_attr is None:
        conn.execute(
            text(f"ALTER TABLE audit_logs ADD COLUMN organization_id {org_type_sql}")
        )
    else:
        aud_typid, aud_typmod, aud_type_sql = audit_attr[0], audit_attr[1], audit_attr[2]
        if (aud_typid, aud_typmod) != (org_typid, org_typmod):
            using = _using_expr_for_type_change(org_type_sql, aud_type_sql)
            conn.execute(
                text(
                    f"ALTER TABLE audit_logs ALTER COLUMN organization_id TYPE {org_type_sql} "
                    f"USING ({using})"
                )
            )

    conn.execute(
        text(
            """
            UPDATE audit_logs a
            SET organization_id = u.organization_id
            FROM users u
            WHERE a.actor_user_id = u.id
              AND a.organization_id IS NULL
            """
        )
    )
    conn.execute(
        text(
            """
            UPDATE audit_logs a
            SET organization_id = u.organization_id
            FROM unit u
            WHERE a.entity_type = 'unit'
              AND a.entity_id = u.id
              AND a.organization_id IS NULL
            """
        )
    )
    conn.execute(
        text(
            """
            UPDATE audit_logs a
            SET organization_id = t.organization_id
            FROM tenant t
            WHERE a.entity_type = 'tenant'
              AND a.entity_id = t.id
              AND a.organization_id IS NULL
            """
        )
    )
    conn.execute(
        text(
            """
            UPDATE audit_logs a
            SET organization_id = t.organization_id
            FROM tenancies t
            WHERE a.entity_type = 'tenancy'
              AND a.entity_id = t.id
              AND a.organization_id IS NULL
            """
        )
    )
    remaining = conn.execute(
        text("SELECT COUNT(*) FROM audit_logs WHERE organization_id IS NULL")
    ).scalar()
    if remaining and int(remaining) > 0:
        raise RuntimeError(
            "Cannot enable RLS on audit_logs: organization_id backfill incomplete "
            f"({remaining} rows still NULL)"
        )
    conn.execute(text("ALTER TABLE audit_logs ALTER COLUMN organization_id SET NOT NULL"))
    op.create_foreign_key(
        "audit_logs_organization_id_fkey",
        "audit_logs",
        "organization",
        ["organization_id"],
        ["id"],
    )
    op.create_index("ix_audit_logs_organization_id", "audit_logs", ["organization_id"])

    # --- users RLS ---
    conn.execute(text("DROP POLICY IF EXISTS org_isolation_users ON users"))
    conn.execute(text("ALTER TABLE users ENABLE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE users FORCE ROW LEVEL SECURITY"))
    conn.execute(
        text(
            """
            CREATE POLICY org_isolation_users ON users FOR ALL
            USING (
                organization_id::text = current_setting('app.current_organization_id', true)
                OR id::text = current_setting('app.current_user_id', true)
                OR current_setting('app.auth_unscoped_user_lookup', true) = 'true'
            )
            WITH CHECK (
                organization_id::text = current_setting('app.current_organization_id', true)
                OR id::text = current_setting('app.current_user_id', true)
            )
            """
        )
    )

    # --- audit_logs RLS ---
    conn.execute(text("DROP POLICY IF EXISTS org_isolation_audit_logs ON audit_logs"))
    conn.execute(text("ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY"))
    conn.execute(
        text(
            """
            CREATE POLICY org_isolation_audit_logs ON audit_logs FOR ALL
            USING (organization_id::text = current_setting('app.current_organization_id', true))
            WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true))
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(text("DROP POLICY IF EXISTS org_isolation_audit_logs ON audit_logs"))
    conn.execute(text("ALTER TABLE audit_logs NO FORCE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY"))

    conn.execute(text("DROP POLICY IF EXISTS org_isolation_users ON users"))
    conn.execute(text("ALTER TABLE users NO FORCE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE users DISABLE ROW LEVEL SECURITY"))

    op.drop_index("ix_audit_logs_organization_id", table_name="audit_logs")
    op.drop_constraint("audit_logs_organization_id_fkey", "audit_logs", type_="foreignkey")
    op.drop_column("audit_logs", "organization_id")
