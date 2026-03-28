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

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "042_rls_users_audit_logs"
down_revision: Union[str, None] = "041_unit_landlord_lease"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # --- audit_logs: organization_id ---
    conn.execute(
        text(
            """
            ALTER TABLE audit_logs
            ADD COLUMN IF NOT EXISTS organization_id VARCHAR
            """
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
