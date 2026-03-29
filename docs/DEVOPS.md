# FeelAtHomeNow — DevOps & Infrastructure

This document describes how to run the project locally, with Docker, and how the infrastructure is set up.

**Stack note:** The frontend is **Create React App (CRA)** with craco, not Vite. Build output is `build/`; environment variables use the `REACT_APP_` prefix (not Vite’s `VITE_`). Docker and CI are aligned with this.

---

## Running locally (development)

### Prerequisites

- Python 3.11
- Node 20 (or 18+)
- PostgreSQL 15 (or compatible)
- Yarn or npm (frontend)

### Backend

1. From project root, go to `backend/`.
2. Copy env: `cp .env.example .env` (repo root for Docker) or create `backend/.env` for local uvicorn; set `SECRET_KEY`. For PostgreSQL, **`DATABASE_URL` must be the application role** (NOSUPERUSER, NOBYPASSRLS), not `postgres` / a superuser, or RLS is bypassed. Use `MIGRATE_DATABASE_URL` for Alembic when it differs (see Docker section).
3. Create a virtualenv and install deps:
   ```bash
   python -m venv .venv
   source .venv/bin/activate   # or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```
4. Run migrations with a **privileged** URL (can CREATE/ALTER tables), then run `python scripts/ci_grant_app_role.py` if you use a split app role (same env vars as CI: `MIGRATE_DATABASE_URL`, `CI_MIGRATION_ROLE`, `CI_APP_ROLE_PASSWORD`). If you use one superuser URL for both migrate and app during dev only, RLS will not apply — avoid that for realistic testing.
5. Start the API: `uvicorn server:app --reload --host 127.0.0.1 --port 8000` — **`DATABASE_URL` must point at the app role** (`feelathomenow_app` or equivalent) so RLS is enforced.

API: http://localhost:8000  
Docs: http://localhost:8000/docs

### Frontend

1. From project root, go to `frontend/`.
2. Install deps: `npm ci` or `yarn install`
3. Start dev server: `npm start` or `yarn start`

Frontend: http://localhost:3000 (or the port printed by the script).  
Set `REACT_APP_API_URL=http://localhost:8000` in `frontend/.env` if the API runs elsewhere.

---

## Running with Docker

### One-time setup

1. Copy env and set required variables:
   ```bash
   cp .env.example .env
   # Edit .env: POSTGRES_PASSWORD, POSTGRES_APP_PASSWORD, SECRET_KEY (see .env.example)
   ```

2. Build and start all services:
   ```bash
   docker compose up -d --build
   ```

### Services

| Service   | Image / build     | Port  | Description                    |
|----------|-------------------|------|--------------------------------|
| postgres | postgres:15       | 5432 | PostgreSQL database            |
| backend  | build: ./backend  | 8000 | FastAPI app + Alembic on start |
| frontend | build: ./frontend | 80   | Nginx serving built React app  |

- **Backend**: On startup, the backend runs `alembic upgrade head` (using **`MIGRATE_DATABASE_URL`**, the bootstrap Postgres user), then **`python scripts/ci_grant_app_role.py`** to create/update the **`feelathomenow_app`** role (NOSUPERUSER, NOBYPASSRLS) and grants, then **`uvicorn`** with **`DATABASE_URL`** set to that app user only. The runtime process never connects as a superuser.
- **Frontend**: CRA/craco build with Node 20; output is `build/`. Nginx serves that folder on port 80. The build uses `REACT_APP_API_URL` from `.env` or docker-compose build-args so the app talks to the correct API (e.g. `http://localhost:8000` when backend is on the same host).

### URLs

- Frontend: http://localhost (or http://localhost:80)
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

### Healthchecks

- **Backend**: `GET http://localhost:8000/api/health` — returns `{"status": "healthy", ...}`. Used by Docker healthcheck and orchestrators.
- **Postgres**: `pg_isready` inside the postgres container. Backend `depends_on: postgres (healthy)` so the API starts after the DB is ready.

---

## Environment variables

Documented in **repo root `.env.example`**. Main ones:

| Variable | Used by | Description |
|----------|---------|-------------|
| `DATABASE_URL` | backend | **Runtime** connection: must be the **app** role (`feelathomenow_app`), not a superuser, or RLS is bypassed. |
| `MIGRATE_DATABASE_URL` | Alembic, `scripts/ci_grant_app_role.py` | Optional. Privileged URL for DDL and role grants. If unset, migrations fall back to `DATABASE_URL` (same as historical behavior). |
| `CI_MIGRATION_ROLE` | `scripts/ci_grant_app_role.py` | Name of the role that owns migrated tables (`postgres` in Docker; `ci_user` in GitHub Actions). |
| `CI_APP_ROLE_PASSWORD` | `scripts/ci_grant_app_role.py` | Password for `feelathomenow_app` (must match the password embedded in `DATABASE_URL` for the app user). |
| `POSTGRES_USER` | postgres image | Bootstrap superuser (default `postgres`). Used only for initdb and `MIGRATE_DATABASE_URL` in compose. |
| `POSTGRES_APP_USER` | compose | App role name (default `feelathomenow_app`). |
| `POSTGRES_APP_PASSWORD` | compose / app role | Password for the app role (required in compose). |
| `POSTGRES_PASSWORD` | postgres image | Bootstrap user password (required in compose). |
| `POSTGRES_DB` | postgres | Database name (default `feelathomenow`). |
| `SECRET_KEY` | backend | JWT/auth secret (required). |
| `ENVIRONMENT` | backend | e.g. development, production (for Sentry env). |
| `SENTRY_DSN` | backend | Optional; if set, Sentry is initialized. |
| `REACT_APP_API_URL` | frontend | API base URL (build-time). |
| `REACT_APP_ADMIN_API_KEY` | frontend | Optional; X-API-Key for admin API. |
| `REACT_APP_SENTRY_DSN` | frontend | Optional. |

Backend loads `backend/.env` via `python-dotenv` when running locally; in Docker, compose injects variables (see `docker-compose.yml`); a root `.env` supplies secrets to compose.

### Verifying RLS is active for the runtime role

Connect with the **same** `DATABASE_URL` the app uses (not `postgres`), then run:

```sql
SELECT current_user, session_user;
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
```

Expect **`rolsuper = false`** and **`rolbypassrls = false`**. If either is true, Row Level Security does not apply to that session the way production intends.

`backend/tests/test_rls.py` (`test_rls_environment_validates_database_role_and_policies`) encodes the same checks in CI.

---

## Services architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Frontend   │     │   Backend   │
│             │     │  (nginx:80)  │────▶│ (uvicorn    │
│             │     │  static SPA  │     │  :8000)     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  Postgres   │
                                        │   :5432     │
                                        └─────────────┘
```

- Frontend is a static bundle (React) built at image build time; nginx serves it and handles SPA fallback.
- Backend depends on Postgres; compose waits for postgres to be healthy before starting the backend.
- Migrations run inside the backend container on every start via the entrypoint script.

---

## Migrations in Docker

Migrations run automatically when the backend container starts:

1. Entrypoint `scripts/entrypoint.sh`: `alembic upgrade head` (uses `MIGRATE_DATABASE_URL` when set in `backend/alembic/env.py`).
2. `python scripts/ci_grant_app_role.py` — ensures `feelathomenow_app` exists with NOBYPASSRLS and table grants.
3. `uvicorn server:app` — uses **`DATABASE_URL` only** (app role).

For local development **without** Docker, run Alembic with a privileged `MIGRATE_DATABASE_URL` (or a single privileged `DATABASE_URL` only if you accept no RLS during that dev session), then point **`DATABASE_URL` at the app role** before running the API.

---

## Testing

See **[docs/archive/TESTING.md](archive/TESTING.md)** for historical testing notes. Prefer `backend/tests` and `.github/workflows/ci.yml` for current behavior.

---

## CI/CD

- **Location**: `.github/workflows/ci.yml`
- **Triggers**: Push and pull requests to `main` or `master`
- **Backend job**: PostgreSQL 16 service → `alembic upgrade head` (as migration user) → `python scripts/ci_grant_app_role.py` → `pytest` with **`DATABASE_URL` / `TEST_DATABASE_URL` pointing at `feelathomenow_app`** (non-superuser, NOBYPASSRLS), matching the Docker split-role model.
- **Frontend job**: `npm ci` → targeted Jest → `npm run build`.

Separate workflows may handle backups (`backup.yml`, `render-backup.yml`); see those files for secrets.

---

## Health endpoint verification

- **URL**: `GET /api/health`
- **Response**: `200 OK` with JSON, e.g. `{"status": "healthy", "service": "feelathomenow-api", "timestamp": "..."}`

Existing implementation in `backend/server.py` (under `api_router`, prefix `/api`). No duplicate was added. Docker backend healthcheck uses: `curl -f http://localhost:8000/api/health`.
