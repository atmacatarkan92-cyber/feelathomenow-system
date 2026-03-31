"""Add unit.updated_at for admin metadata consistency.

Revision ID: 054_unit_updated_at
Revises: 053_owner_address_fields
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "054_unit_updated_at"
down_revision: Union[str, None] = "053_owner_address_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("unit", sa.Column("updated_at", sa.DateTime(timezone=False), nullable=True))
    op.execute("UPDATE unit SET updated_at = created_at WHERE updated_at IS NULL")


def downgrade() -> None:
    op.drop_column("unit", "updated_at")
