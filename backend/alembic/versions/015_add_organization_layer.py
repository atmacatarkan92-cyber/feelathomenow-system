"""Add Organization model and organization_id FKs to core tables.

Revision ID: 015_add_organization_layer
Revises: 014_tenant_room_id_nullable
Create Date: 2026-03-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "015_add_organization_layer"
down_revision: Union[str, None] = "014_tenant_room_id_nullable"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organization",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="organization_pkey"),
    )

    # Add nullable organization_id columns (migration-safe)
    op.add_column("tenant", sa.Column("organization_id", sa.String(), nullable=True))
    op.add_column("unit", sa.Column("organization_id", sa.String(), nullable=True))
    op.add_column("tenancies", sa.Column("organization_id", sa.String(), nullable=True))
    op.add_column("invoices", sa.Column("organization_id", sa.String(), nullable=True))
    op.add_column("properties", sa.Column("organization_id", sa.String(), nullable=True))

    # Indexes
    op.create_index("ix_tenant_organization_id", "tenant", ["organization_id"], unique=False)
    op.create_index("ix_unit_organization_id", "unit", ["organization_id"], unique=False)
    op.create_index("ix_tenancies_organization_id", "tenancies", ["organization_id"], unique=False)
    op.create_index("ix_invoices_organization_id", "invoices", ["organization_id"], unique=False)
    op.create_index("ix_properties_organization_id", "properties", ["organization_id"], unique=False)

    # FKs
    op.create_foreign_key(
        "tenant_organization_id_fkey",
        "tenant",
        "organization",
        ["organization_id"],
        ["id"],
    )
    op.create_foreign_key(
        "unit_organization_id_fkey",
        "unit",
        "organization",
        ["organization_id"],
        ["id"],
    )
    op.create_foreign_key(
        "tenancies_organization_id_fkey",
        "tenancies",
        "organization",
        ["organization_id"],
        ["id"],
    )
    op.create_foreign_key(
        "invoices_organization_id_fkey",
        "invoices",
        "organization",
        ["organization_id"],
        ["id"],
    )
    op.create_foreign_key(
        "properties_organization_id_fkey",
        "properties",
        "organization",
        ["organization_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("properties_organization_id_fkey", "properties", type_="foreignkey")
    op.drop_constraint("invoices_organization_id_fkey", "invoices", type_="foreignkey")
    op.drop_constraint("tenancies_organization_id_fkey", "tenancies", type_="foreignkey")
    op.drop_constraint("unit_organization_id_fkey", "unit", type_="foreignkey")
    op.drop_constraint("tenant_organization_id_fkey", "tenant", type_="foreignkey")

    op.drop_index("ix_properties_organization_id", table_name="properties")
    op.drop_index("ix_invoices_organization_id", table_name="invoices")
    op.drop_index("ix_tenancies_organization_id", table_name="tenancies")
    op.drop_index("ix_unit_organization_id", table_name="unit")
    op.drop_index("ix_tenant_organization_id", table_name="tenant")

    op.drop_column("properties", "organization_id")
    op.drop_column("invoices", "organization_id")
    op.drop_column("tenancies", "organization_id")
    op.drop_column("unit", "organization_id")
    op.drop_column("tenant", "organization_id")

    op.drop_table("organization")

