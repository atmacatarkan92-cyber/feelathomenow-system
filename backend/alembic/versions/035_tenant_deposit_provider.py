"""Tenancy: optional tenant_deposit_provider (insurance).

Revision ID: 035_tenant_deposit_provider
Revises: 034_tenant_deposit
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "035_tenant_deposit_provider"
down_revision: Union[str, None] = "034_tenant_deposit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenancies",
        sa.Column("tenant_deposit_provider", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tenancies", "tenant_deposit_provider")
