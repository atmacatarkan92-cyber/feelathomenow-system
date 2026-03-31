"""Owners (Eigentümer) + unit.owner_id.

Revision ID: 052_owners_and_unit_owner_id
Revises: 051_property_manager_notes
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "052_owners_and_unit_owner_id"
down_revision: Union[str, None] = "051_property_manager_notes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "owners",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("organization_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_owners_organization_id", "owners", ["organization_id"])
    op.create_index("ix_owners_status", "owners", ["status"])

    op.add_column(
        "unit",
        sa.Column("owner_id", sa.String(), nullable=True),
    )
    op.create_index("ix_unit_owner_id", "unit", ["owner_id"])
    op.create_foreign_key(
        "fk_unit_owner_id_owners",
        "unit",
        "owners",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_unit_owner_id_owners", "unit", type_="foreignkey")
    op.drop_index("ix_unit_owner_id", table_name="unit")
    op.drop_column("unit", "owner_id")
    op.drop_index("ix_owners_status", table_name="owners")
    op.drop_index("ix_owners_organization_id", table_name="owners")
    op.drop_table("owners")
