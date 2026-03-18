"""Backfill organization_id and enforce NOT NULL on core tables.

Revision ID: 016_org_scoping_hardening
Revises: 015_add_organization_layer
Create Date: 2026-03-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
import uuid

revision: str = "016_org_scoping_hardening"
down_revision: Union[str, None] = "015_add_organization_layer"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Ensure organization_id columns, indexes, and FKs exist (defensive, idempotent).
    for table, fk_name, idx_name in [
        ("tenant", "tenant_organization_id_fkey", "ix_tenant_organization_id"),
        ("unit", "unit_organization_id_fkey", "ix_unit_organization_id"),
        ("tenancies", "tenancies_organization_id_fkey", "ix_tenancies_organization_id"),
        ("invoices", "invoices_organization_id_fkey", "ix_invoices_organization_id"),
        ("properties", "properties_organization_id_fkey", "ix_properties_organization_id"),
    ]:
        # Add column if missing
        conn.execute(
            text(
                f"ALTER TABLE {table} "
                "ADD COLUMN IF NOT EXISTS organization_id VARCHAR"
            )
        )
        # Add index if missing
        conn.execute(
            text(
                "DO $$ BEGIN "
                "IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :idx) THEN "
                f"CREATE INDEX {idx_name} ON {table} (organization_id); "
                "END IF; "
                "END $$;"
            ),
            {"idx": idx_name},
        )
        # Add FK if missing
        conn.execute(
            text(
                "DO $$ BEGIN "
                "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = :fk) THEN "
                f"ALTER TABLE {table} "
                f"ADD CONSTRAINT {fk_name} FOREIGN KEY (organization_id) REFERENCES organization(id); "
                "END IF; "
                "END $$;"
            ),
            {"fk": fk_name},
        )

    # Step A: ensure a default organization exists and get its id.
    row = conn.execute(
        text("SELECT id FROM organization ORDER BY created_at LIMIT 1")
    ).fetchone()
    if row:
        default_org_id = row[0]
    else:
        default_org_id = str(uuid.uuid4())
        conn.execute(
            text(
                "INSERT INTO organization (id, name, created_at) "
                "VALUES (:id, :name, NOW())"
            ),
            {"id": default_org_id, "name": "Default"},
        )

    # Step B: backfill NULL organization_id values on all relevant tables.
    for table in ("tenant", "unit", "tenancies", "invoices", "properties"):
        conn.execute(
            text(
                f"UPDATE {table} "
                "SET organization_id = :org_id "
                "WHERE organization_id IS NULL"
            ),
            {"org_id": default_org_id},
        )

    # Step C: enforce NOT NULL on organization_id columns.
    op.alter_column("tenant", "organization_id", existing_type=sa.String(), nullable=False)
    op.alter_column("unit", "organization_id", existing_type=sa.String(), nullable=False)
    op.alter_column("tenancies", "organization_id", existing_type=sa.String(), nullable=False)
    op.alter_column("invoices", "organization_id", existing_type=sa.String(), nullable=False)
    op.alter_column("properties", "organization_id", existing_type=sa.String(), nullable=False)


def downgrade() -> None:
    # Allow NULLs again on organization_id columns.
    op.alter_column("properties", "organization_id", existing_type=sa.String(), nullable=True)
    op.alter_column("invoices", "organization_id", existing_type=sa.String(), nullable=True)
    op.alter_column("tenancies", "organization_id", existing_type=sa.String(), nullable=True)
    op.alter_column("unit", "organization_id", existing_type=sa.String(), nullable=True)
    op.alter_column("tenant", "organization_id", existing_type=sa.String(), nullable=True)

