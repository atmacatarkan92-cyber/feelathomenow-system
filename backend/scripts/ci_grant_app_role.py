#!/usr/bin/env python3
"""
Create a non-superuser app role and grant DML on public schema.

Run after `alembic upgrade head` using the **privileged** connection (same user that
owns migrated tables).

Environment:
  MIGRATE_DATABASE_URL — Preferred URL for this script (bootstrap / migration user).
  If unset, falls back to DATABASE_URL (legacy single-URL setups).
  CI_MIGRATION_ROLE — Role that owns new tables (default: ci_user). Use `postgres` in
    Docker Compose (`CI_MIGRATION_ROLE` is set there).
  CI_APP_ROLE_PASSWORD — Password for feelathomenow_app (default: feelathomenow_app_ci_pass).

Runtime `DATABASE_URL` must use `feelathomenow_app` so PostgreSQL RLS applies.
"""
from __future__ import annotations

import os
import re
import sys

import psycopg2
from sqlalchemy.engine.url import make_url

APP_ROLE = "feelathomenow_app"
_DEFAULT_PW = "feelathomenow_app_ci_pass"


def _validate_migration_role(name: str) -> str:
    if not re.match(r"^[a-z_][a-z0-9_]*$", name, re.I):
        raise ValueError(f"Invalid migration role name: {name!r}")
    return name


def main() -> int:
    raw = os.environ.get("MIGRATE_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not raw:
        print("Set MIGRATE_DATABASE_URL to the migration superuser URL.", file=sys.stderr)
        return 1
    migration_role = _validate_migration_role(os.environ.get("CI_MIGRATION_ROLE", "ci_user"))
    password = os.environ.get("CI_APP_ROLE_PASSWORD", _DEFAULT_PW)

    url = make_url(raw)
    if not url.database:
        print("DATABASE URL must include database name.", file=sys.stderr)
        return 1

    conn = psycopg2.connect(
        host=url.host or "localhost",
        port=url.port or 5432,
        dbname=url.database,
        user=url.username,
        password=url.password,
    )
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (APP_ROLE,))
            if not cur.fetchone():
                cur.execute(
                    f"""
                    CREATE ROLE {APP_ROLE} LOGIN PASSWORD %s
                    NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION
                    """,
                    (password,),
                )
            cur.execute(f"ALTER ROLE {APP_ROLE} PASSWORD %s", (password,))
            cur.execute(f"ALTER ROLE {APP_ROLE} NOBYPASSRLS")
            cur.execute(f"ALTER ROLE {APP_ROLE} NOSUPERUSER")

            cur.execute(
                f"""
                DO $$
                BEGIN
                  EXECUTE format(
                    'GRANT CONNECT ON DATABASE %I TO %I',
                    current_database(),
                    '{APP_ROLE}'
                  );
                END
                $$;
                """
            )

            cur.execute(f"GRANT USAGE ON SCHEMA public TO {APP_ROLE}")
            cur.execute(
                f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {APP_ROLE}"
            )
            cur.execute(
                f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {APP_ROLE}"
            )

            cur.execute(
                f"""
                ALTER DEFAULT PRIVILEGES FOR ROLE {migration_role} IN SCHEMA public
                GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {APP_ROLE}
                """
            )
            cur.execute(
                f"""
                ALTER DEFAULT PRIVILEGES FOR ROLE {migration_role} IN SCHEMA public
                GRANT USAGE, SELECT ON SEQUENCES TO {APP_ROLE}
                """
            )
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
