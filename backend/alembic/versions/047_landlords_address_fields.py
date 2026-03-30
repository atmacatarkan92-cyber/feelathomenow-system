"""Landlords: optional address and website fields.

Revision ID: 047_landlords_address_fields
Revises: 046_fix_listing_rls
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "047_landlords_address_fields"
down_revision: Union[str, None] = "046_fix_listing_rls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("landlords", sa.Column("address_line1", sa.String(), nullable=True))
    op.add_column("landlords", sa.Column("postal_code", sa.String(), nullable=True))
    op.add_column("landlords", sa.Column("city", sa.String(), nullable=True))
    op.add_column("landlords", sa.Column("canton", sa.String(), nullable=True))
    op.add_column("landlords", sa.Column("website", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("landlords", "website")
    op.drop_column("landlords", "canton")
    op.drop_column("landlords", "city")
    op.drop_column("landlords", "postal_code")
    op.drop_column("landlords", "address_line1")
