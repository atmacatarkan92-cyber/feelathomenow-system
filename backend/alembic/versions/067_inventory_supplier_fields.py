"""Add supplier_article_number and product_url to inventory_items.

Revision ID: 067_inventory_supplier_fields
Revises: 066_inventory
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "067_inventory_supplier_fields"
down_revision: Union[str, None] = "066_inventory"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        text(
            """
            ALTER TABLE inventory_items
            ADD COLUMN IF NOT EXISTS supplier_article_number VARCHAR(200) NULL
            """
        )
    )
    op.execute(
        text(
            """
            ALTER TABLE inventory_items
            ADD COLUMN IF NOT EXISTS product_url VARCHAR(500) NULL
            """
        )
    )


def downgrade() -> None:
    op.execute(text("ALTER TABLE inventory_items DROP COLUMN IF EXISTS product_url"))
    op.execute(text("ALTER TABLE inventory_items DROP COLUMN IF EXISTS supplier_article_number"))
