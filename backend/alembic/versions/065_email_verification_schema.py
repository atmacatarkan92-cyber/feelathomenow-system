"""users.email_verified_at + email_verification_tokens (foundation for verify-email flow)

Revision ID: 065_email_verification_schema
Revises: 064_audit_logs_platform_extend

- Nullable email_verified_at on users; backfill existing rows as verified (NOW()).
- New table email_verification_tokens: hashed token, single-use (used_at), expiry (expires_at).
- RLS mirrors password_reset_tokens (org via users + trusted GUC by token_hash).
- FK user_id -> users(id) ON DELETE CASCADE (matches password_reset_tokens post-046).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy import text

from alembic import op

revision: str = "065_email_verification_schema"
down_revision: Union[str, None] = "064_audit_logs_platform_extend"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(), nullable=True))
    op.execute(
        text("UPDATE users SET email_verified_at = NOW() WHERE email_verified_at IS NULL")
    )

    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_email_verification_tokens_user_id",
        "email_verification_tokens",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_email_verification_tokens_token_hash",
        "email_verification_tokens",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_email_verification_tokens_expires_at",
        "email_verification_tokens",
        ["expires_at"],
        unique=False,
    )

    conn = op.get_bind()
    conn.execute(
        text("DROP POLICY IF EXISTS org_isolation_email_verification_tokens ON email_verification_tokens")
    )
    conn.execute(text("ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE email_verification_tokens FORCE ROW LEVEL SECURITY"))
    conn.execute(
        text(
            """
            CREATE POLICY org_isolation_email_verification_tokens ON email_verification_tokens FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = email_verification_tokens.user_id
                    AND u.organization_id::text = current_setting('app.current_organization_id', true)
                )
                OR (
                    email_verification_tokens.token_hash IS NOT NULL
                    AND email_verification_tokens.token_hash = current_setting('app.current_email_verification_token_hash', true)
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = email_verification_tokens.user_id
                    AND u.organization_id::text = current_setting('app.current_organization_id', true)
                )
                OR (
                    email_verification_tokens.token_hash IS NOT NULL
                    AND email_verification_tokens.token_hash = current_setting('app.current_email_verification_token_hash', true)
                )
            )
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text(
            "DROP POLICY IF EXISTS org_isolation_email_verification_tokens ON email_verification_tokens"
        )
    )
    conn.execute(text("ALTER TABLE email_verification_tokens NO FORCE ROW LEVEL SECURITY"))
    conn.execute(text("ALTER TABLE email_verification_tokens DISABLE ROW LEVEL SECURITY"))

    op.drop_index("ix_email_verification_tokens_expires_at", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_token_hash", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_user_id", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")

    op.drop_column("users", "email_verified_at")
