"""Add unit latitude, longitude, geocoded_at for portfolio map unit-first pins.

Revision ID: 069_unit_coordinates
Revises: 068_unit_short_unit_id
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "069_unit_coordinates"
down_revision: Union[str, None] = "068_unit_short_unit_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        text(
            """
            ALTER TABLE unit
            ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION NULL
            """
        )
    )
    op.execute(
        text(
            """
            ALTER TABLE unit
            ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION NULL
            """
        )
    )
    op.execute(
        text(
            """
            ALTER TABLE unit
            ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP NULL
            """
        )
    )


def downgrade() -> None:
    op.execute(text("ALTER TABLE unit DROP COLUMN IF EXISTS geocoded_at"))
    op.execute(text("ALTER TABLE unit DROP COLUMN IF EXISTS longitude"))
    op.execute(text("ALTER TABLE unit DROP COLUMN IF EXISTS latitude"))
