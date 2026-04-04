"""Add supplier_article_number and product_url to inventory_items.

Revision ID: 067_inventory_supplier_fields
Revises: 066_inventory
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "067_inventory_supplier_fields"
down_revision: Union[str, None] = "066_inventory"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "inventory_items",
        sa.Column("supplier_article_number", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "inventory_items",
        sa.Column("product_url", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("inventory_items", "product_url")
    op.drop_column("inventory_items", "supplier_article_number")
