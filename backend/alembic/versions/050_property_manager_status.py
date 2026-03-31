"""Add status to property_managers (active / inactive).

Revision ID: 050_property_manager_status
Revises: 049_landlord_documents
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "050_property_manager_status"
down_revision: Union[str, None] = "049_landlord_documents"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "property_managers",
        sa.Column("status", sa.String(length=32), nullable=True),
    )
    op.execute(text("UPDATE property_managers SET status = 'active' WHERE status IS NULL"))
    op.alter_column(
        "property_managers",
        "status",
        nullable=False,
        server_default=sa.text("'active'"),
    )


def downgrade() -> None:
    op.drop_column("property_managers", "status")
