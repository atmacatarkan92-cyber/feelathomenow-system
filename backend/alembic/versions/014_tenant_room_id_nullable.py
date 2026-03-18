"""Make tenant.room_id nullable (room assignment happens later).

Revision ID: 014_tenant_room_id_nullable
Revises: 013_audit_logs
Create Date: 2026-03-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "014_tenant_room_id_nullable"
down_revision: Union[str, None] = "013_audit_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "tenant",
        "room_id",
        existing_type=sa.String(),
        nullable=True,
    )


def downgrade() -> None:
    conn = op.get_bind()
    null_count = conn.execute(
        text("SELECT COUNT(*) FROM tenant WHERE room_id IS NULL")
    ).scalar()
    if null_count and int(null_count) > 0:
        raise RuntimeError(
            "Cannot downgrade: tenant.room_id contains NULL values. "
            "Assign room_id for all tenants before downgrading."
        )
    op.alter_column(
        "tenant",
        "room_id",
        existing_type=sa.String(),
        nullable=False,
    )

