"""Extend audit_logs for platform events + cross-org read for platform list.

Revision ID: 064_audit_logs_platform_extend
Revises: 063_platform_admin_role

- Add actor_email, metadata (JSONB); widen action to VARCHAR(128).
- Add permissive SELECT policy when app.platform_audit_full_read = 'true' (SET LOCAL in app only).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "064_audit_logs_platform_extend"
down_revision: Union[str, None] = "063_platform_admin_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("actor_email", sa.String(length=320), nullable=True))
    op.add_column("audit_logs", sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.alter_column(
        "audit_logs",
        "action",
        existing_type=sa.String(length=32),
        type_=sa.String(length=128),
        existing_nullable=False,
    )
    conn = op.get_bind()
    conn.execute(
        text(
            """
            CREATE POLICY audit_logs_select_when_platform_full_read ON audit_logs
            FOR SELECT
            USING (current_setting('app.platform_audit_full_read', true) = 'true')
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DROP POLICY IF EXISTS audit_logs_select_when_platform_full_read ON audit_logs"))
    op.alter_column(
        "audit_logs",
        "action",
        existing_type=sa.String(length=128),
        type_=sa.String(length=32),
        existing_nullable=False,
    )
    op.drop_column("audit_logs", "metadata")
    op.drop_column("audit_logs", "actor_email")
