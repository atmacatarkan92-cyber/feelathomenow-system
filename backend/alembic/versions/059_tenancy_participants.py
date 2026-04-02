"""Tenancy participants: people linked to one occupancy contract (tenancy row).

Revision ID: 059_tenancy_participants
Revises: 058_tenancy_lifecycle

One tenancy row = one room occupancy contract. tenancy_participants links tenant persons to that
contract with a role (primary_tenant, co_tenant, solidarhafter). Existing tenancies.tenant_id is
backfilled as primary_tenant and remains the invoice / compatibility primary in Phase 1.

RLS: organization_id matches other org-scoped tables.

FK column types match referenced tables at runtime (CI vs Render UUID vs VARCHAR); see 042/043/045.
"""

import re
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "059_tenancy_participants"
down_revision: Union[str, None] = "058_tenancy_lifecycle"
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
        raise RuntimeError(f"059: refusing unsafe FK column type fragment: {s!r}")
    return s


def upgrade() -> None:
    conn = op.get_bind()

    org_attr = _pg_column_format_type(conn, "organization", "id")
    if not org_attr:
        raise RuntimeError("059: public.organization.id not found")
    org_type_sql = _validate_type_sql_fragment(org_attr[2])

    tenancies_attr = _pg_column_format_type(conn, "tenancies", "id")
    if not tenancies_attr:
        raise RuntimeError("059: public.tenancies.id not found")
    tenancy_id_type_sql = _validate_type_sql_fragment(tenancies_attr[2])

    tenant_attr = _pg_column_format_type(conn, "tenant", "id")
    if not tenant_attr:
        raise RuntimeError("059: public.tenant.id not found")
    tenant_id_type_sql = _validate_type_sql_fragment(tenant_attr[2])

    conn.execute(
        text(
            f"""
            CREATE TABLE tenancy_participants (
                id TEXT NOT NULL,
                organization_id {org_type_sql} NOT NULL,
                tenancy_id {tenancy_id_type_sql} NOT NULL,
                tenant_id {tenant_id_type_sql} NOT NULL,
                role VARCHAR(32) NOT NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT tenancy_participants_pkey PRIMARY KEY (id),
                CONSTRAINT tenancy_participants_organization_id_fkey
                    FOREIGN KEY (organization_id) REFERENCES organization (id),
                CONSTRAINT tenancy_participants_tenancy_id_fkey
                    FOREIGN KEY (tenancy_id) REFERENCES tenancies (id) ON DELETE CASCADE,
                CONSTRAINT tenancy_participants_tenant_id_fkey
                    FOREIGN KEY (tenant_id) REFERENCES tenant (id),
                CONSTRAINT uq_tenancy_participant_tenancy_tenant UNIQUE (tenancy_id, tenant_id),
                CONSTRAINT ck_tenancy_participants_role_allowed CHECK (
                    role IN ('primary_tenant', 'co_tenant', 'solidarhafter')
                )
            )
            """
        )
    )

    op.create_index("ix_tenancy_participants_organization_id", "tenancy_participants", ["organization_id"])
    op.create_index("ix_tenancy_participants_tenancy_id", "tenancy_participants", ["tenancy_id"])
    op.create_index("ix_tenancy_participants_tenant_id", "tenancy_participants", ["tenant_id"])

    # Backfill: each existing tenancy gets one primary_tenant row mirroring tenancies.tenant_id
    conn.execute(
        text(
            """
            INSERT INTO tenancy_participants (id, organization_id, tenancy_id, tenant_id, role, created_at)
            SELECT gen_random_uuid()::text, t.organization_id, t.id, t.tenant_id, 'primary_tenant', NOW()
            FROM tenancies t
            """
        )
    )

    conn.execute(text("ALTER TABLE tenancy_participants ENABLE ROW LEVEL SECURITY"))
    conn.execute(text("DROP POLICY IF EXISTS org_isolation_tenancy_participants ON tenancy_participants"))
    conn.execute(
        text(
            """
            CREATE POLICY org_isolation_tenancy_participants ON tenancy_participants FOR ALL
            USING (organization_id::text = current_setting('app.current_organization_id', true))
            WITH CHECK (organization_id::text = current_setting('app.current_organization_id', true))
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DROP POLICY IF EXISTS org_isolation_tenancy_participants ON tenancy_participants"))
    conn.execute(text("ALTER TABLE tenancy_participants DISABLE ROW LEVEL SECURITY"))
    op.drop_index("ix_tenancy_participants_tenant_id", table_name="tenancy_participants")
    op.drop_index("ix_tenancy_participants_tenancy_id", table_name="tenancy_participants")
    op.drop_index("ix_tenancy_participants_organization_id", table_name="tenancy_participants")
    op.drop_table("tenancy_participants")
