"""
Alembic env.py — uses existing backend db (sync SQLAlchemy/psycopg2).
Loads backend/.env and SQLModel metadata so migrations stay in sync with db/models.py.
"""
from logging.config import fileConfig

from alembic import context
from sqlmodel import SQLModel

# Ensure backend root is on path and .env is loaded before importing db
import os
import sys
from pathlib import Path

_backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend_root))

from dotenv import load_dotenv
load_dotenv(_backend_root / ".env")

from sqlalchemy import create_engine

from db.database import get_migration_database_url
from db import models  # noqa: F401 — register all table models on SQLModel.metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata

_echo = os.getenv("SQL_ECHO", "").lower() in ("1", "true", "yes")


def get_url():
    """Privileged migration URL: MIGRATE_DATABASE_URL, else DATABASE_URL / PG_*."""
    url = get_migration_database_url()
    if url:
        return url
    return config.get_main_option("sqlalchemy.url")


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB; only generates SQL)."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connects to DB)."""
    mig_url = get_migration_database_url()
    if not mig_url:
        raise RuntimeError(
            "PostgreSQL is not configured. Set MIGRATE_DATABASE_URL or DATABASE_URL or PG_* in backend/.env."
        )
    connectable = create_engine(
        mig_url,
        echo=_echo,
        pool_pre_ping=True,
        connect_args={"client_encoding": "utf8"},
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
