"""Add persistent short_unit_id on unit (unique per organization).

Revision ID: 068_unit_short_unit_id
Revises: 067_inventory_supplier_fields
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text
from sqlalchemy.orm import Session

revision: str = "068_unit_short_unit_id"
down_revision: Union[str, None] = "067_inventory_supplier_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        text(
            """
            ALTER TABLE unit
            ADD COLUMN IF NOT EXISTS short_unit_id VARCHAR(32) NULL
            """
        )
    )

    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        from app.services.unit_short_id import backfill_all_units

        backfill_all_units(session)
        session.commit()
    finally:
        session.close()

    op.execute(text("ALTER TABLE unit ALTER COLUMN short_unit_id SET NOT NULL"))
    op.create_index(
        "ix_uq_unit_org_short_unit_id",
        "unit",
        ["organization_id", "short_unit_id"],
        unique=True,
    )


def downgrade() -> None:
    op.execute(text("DROP INDEX IF EXISTS ix_uq_unit_org_short_unit_id"))
    op.execute(text("ALTER TABLE unit DROP COLUMN IF EXISTS short_unit_id"))
