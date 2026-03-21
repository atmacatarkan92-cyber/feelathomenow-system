"""
Temporary production hotfix: ensure users.organization_id exists and is populated.

Use when a deploy missed Alembic migration 018 (users.organization_id). Idempotent;
safe to run on every startup. PostgreSQL only.
"""
from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


def apply_users_organization_id_hotfix(engine) -> None:
    """ALTER / UPDATE / CREATE INDEX — all idempotent on PostgreSQL."""
    if engine is None:
        logger.info("startup_repair_users_org: skipped (no database engine)")
        return

    if engine.dialect.name != "postgresql":
        logger.info(
            "startup_repair_users_org: skipped (dialect=%s, not postgresql)",
            engine.dialect.name,
        )
        return

    logger.info("startup_repair_users_org: checking users.organization_id ...")

    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id VARCHAR"
            )
        )
        logger.info(
            "startup_repair_users_org: ensured column users.organization_id (VARCHAR) exists"
        )

        before = conn.execute(
            text("SELECT COUNT(*) FROM users WHERE organization_id IS NULL")
        ).scalar()

        conn.execute(
            text(
                """
                UPDATE users
                SET organization_id = (
                    SELECT id FROM organization ORDER BY id ASC LIMIT 1
                )
                WHERE organization_id IS NULL
                  AND EXISTS (SELECT 1 FROM organization LIMIT 1)
                """
            )
        )

        after = conn.execute(
            text("SELECT COUNT(*) FROM users WHERE organization_id IS NULL")
        ).scalar()

        if before > 0:
            logger.info(
                "startup_repair_users_org: backfilled users with NULL organization_id "
                "(rows with NULL before=%s, after=%s)",
                before,
                after,
            )
        else:
            logger.info(
                "startup_repair_users_org: no users with NULL organization_id to backfill"
            )

        if after > 0:
            logger.warning(
                "startup_repair_users_org: %s user(s) still have NULL organization_id "
                "(no row in organization table to assign — add an organization or run migrations)",
                after,
            )

        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_users_organization_id ON users (organization_id)"
            )
        )
        logger.info(
            "startup_repair_users_org: ensured index ix_users_organization_id on users(organization_id)"
        )

    logger.info("startup_repair_users_org: finished")
