"""Phase A: additive schema only (listings, unit_costs, payments).

Revision ID: 002_phase_a
Revises: 001_initial
Create Date: Phase A consolidation

- listings: available_from, available_to (DATE, nullable)
- unit_costs: billing_cycle (VARCHAR, nullable, server default 'monthly')
- payments: external_payment_id (VARCHAR, nullable)
- users.role CHECK: defined only in 003_users_role_check (avoids duplicate with that revision).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision: str = "002_phase_a"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CHECK_CONSTRAINT_NAME = "users_role_allowed"  # dropped on downgrade if 003 added it after 002


def _payments_table_exists() -> bool:
    """Legacy `payments` existed in pre-Alembic DBs but is not created by 001_initial."""
    return inspect(op.get_bind()).has_table("payments")


def upgrade() -> None:
    # 1. listings: available_from, available_to (DATE, nullable)
    op.add_column("listings", sa.Column("available_from", sa.Date(), nullable=True))
    op.add_column("listings", sa.Column("available_to", sa.Date(), nullable=True))

    # 2. unit_costs: billing_cycle (VARCHAR, nullable, server default 'monthly')
    op.add_column(
        "unit_costs",
        sa.Column("billing_cycle", sa.String(length=50), nullable=True, server_default="monthly"),
    )

    # 3. payments: external_payment_id — only when legacy table exists (not in 001_initial)
    if _payments_table_exists():
        op.add_column("payments", sa.Column("external_payment_id", sa.String(length=255), nullable=True))


def downgrade() -> None:
    # If 003 ran, constraint exists — drop before reverting 002 (IF EXISTS for legacy partial states)
    op.execute(text(f"ALTER TABLE users DROP CONSTRAINT IF EXISTS {CHECK_CONSTRAINT_NAME}"))

    # 3. payments (legacy table only)
    if _payments_table_exists():
        op.execute(text("ALTER TABLE payments DROP COLUMN IF EXISTS external_payment_id"))

    # 2. unit_costs
    op.drop_column("unit_costs", "billing_cycle")

    # 1. listings
    op.drop_column("listings", "available_to")
    op.drop_column("listings", "available_from")
