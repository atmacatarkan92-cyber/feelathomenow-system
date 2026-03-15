"""Phase E Step 2: drop empty legacy duplicate tables (rooms, units, tenants).

Revision ID: 009_phase_e_legacy_duplicates
Revises: 008_tenancies_tenant_canonical
Create Date: Drop legacy plural tables; application uses canonical singular table names.

- Drops only: rooms, units, tenants (all confirmed empty).
- Canonical tables in use: room, unit, tenant (db.models).
- Downgrade recreates the three tables with original structure for rollback consistency.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "009_phase_e_legacy_duplicates"
down_revision: Union[str, None] = "008_tenancies_tenant_canonical"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop legacy tables. CASCADE drops any FK constraints from other tables
    # (e.g. tenancies_room_fk) that reference these legacy tables; canonical
    # tables (room, unit, tenant) are unchanged.
    op.execute("DROP TABLE IF EXISTS rooms CASCADE")
    op.execute("DROP TABLE IF EXISTS units CASCADE")
    op.execute("DROP TABLE IF EXISTS tenants CASCADE")


def downgrade() -> None:
    # Recreate in order: tenants, units, rooms (rooms has FK to units)
    op.create_table(
        "tenants",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("first_name", sa.Text(), nullable=True),
        sa.Column("last_name", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("nationality", sa.Text(), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "units",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("zip", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("total_rooms", sa.Integer(), nullable=True),
        sa.Column("floor", sa.Integer(), nullable=True),
        sa.Column("size_sqm", sa.Integer(), nullable=True),
        sa.Column("max_tenants", sa.Integer(), nullable=True),
        sa.Column("landlord_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("management_company_id", sa.Integer(), nullable=True),
        sa.Column("property_manager_id", sa.Integer(), nullable=True),
        sa.Column("unit_type", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "rooms",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("unit_id", sa.BigInteger(), nullable=True),
        sa.Column("room_name", sa.Text(), nullable=True),
        sa.Column("room_number", sa.Text(), nullable=True),
        sa.Column("size_sqm", sa.Integer(), nullable=True),
        sa.Column("monthly_rent", sa.Integer(), nullable=True),
        sa.Column("status", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["unit_id"], ["units.id"], name="rooms_unit_id_fkey"),
        sa.PrimaryKeyConstraint("id"),
    )
