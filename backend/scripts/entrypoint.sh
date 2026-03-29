#!/bin/sh
set -e
cd /app
echo "Running migrations (MIGRATE_DATABASE_URL or DATABASE_URL)..."
alembic upgrade head
echo "Ensuring app runtime role (NOBYPASSRLS; same as CI)..."
python scripts/ci_grant_app_role.py
echo "Starting server (DATABASE_URL must be app role, not superuser)..."
exec uvicorn server:app --host 0.0.0.0 --port 8000
