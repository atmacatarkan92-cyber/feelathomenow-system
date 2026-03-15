"""Phase E Step 3: drop billing_runs table (deprecated billing path removed).

Revision ID: 010_phase_e_billing_runs
Revises: 009_phase_e_legacy_duplicates
Create Date: Remove billing_runs; no active code references it after billing_service removal.

- Deprecated services/billing_service.py and test_billing.py were removed in Step 3.
- Active invoice generation uses app.services.invoice_generation_service and db.models.Invoice.
- Downgrade recreates billing_runs with original structure for rollback consistency.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "010_phase_e_billing_runs"
down_revision: Union[str, None] = "009_phase_e_legacy_duplicates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("billing_runs")


def downgrade() -> None:
    op.create_table(
        "billing_runs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("tenancy_id", sa.Integer(), nullable=True),
        sa.Column("invoice_id", sa.Integer(), nullable=True),
        sa.Column("billing_year", sa.Integer(), nullable=False),
        sa.Column("billing_month", sa.Integer(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("status", sa.Text(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
