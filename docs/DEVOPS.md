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
2. Copy env: `cp .env.example .env` (or create `backend/.env` from root `.env.example`; ensure `DATABASE_URL` or `POSTGRES_*` and `SECRET_KEY` are set).
3. Create a virtualenv and install deps:
   ```bash
   python -m venv .venv
   source .venv/bin/activate   # or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```
4. Run migrations: `alembic upgrade head`
5. Start the API: `uvicorn server:app --reload --host 127.0.0.1 --port 8000`

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
   # Edit .env: set POSTGRES_PASSWORD and SECRET_KEY at minimum
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

- **Backend**: On startup, the backend container runs `alembic upgrade head` then starts `uvicorn server:app --host 0.0.0.0 --port 8000`. Migrations run automatically; no manual step needed.
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

Documented in `.env.example`. Main ones:

| Variable               | Used by   | Description |
|------------------------|-----------|-------------|
| `DATABASE_URL`         | backend   | PostgreSQL URL (e.g. `postgresql+psycopg2://user:pass@host:5432/db`) |
| `POSTGRES_USER`        | postgres  | DB user (default: postgres) |
| `POSTGRES_PASSWORD`    | postgres  | DB password (required in compose) |
| `POSTGRES_DB`          | postgres  | DB name (default: feelathomenow) |
| `SECRET_KEY`           | backend   | JWT/auth secret (required) |
| `ENVIRONMENT`          | backend   | e.g. development, production (for Sentry env) |
| `SENTRY_DSN`           | backend   | Optional; if set, Sentry is initialized |
| `REACT_APP_API_URL`| frontend  | API base URL (build-time; e.g. http://localhost:8000) |
| `REACT_APP_ADMIN_API_KEY` | frontend | Optional; X-API-Key for admin API |
| `REACT_APP_SENTRY_DSN` | frontend  | Optional; Sentry DSN if frontend Sentry is enabled |

Backend loads `backend/.env` via `python-dotenv` when running locally; in Docker, variables are passed by compose, so no `.env` file is required inside the container.

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

1. Entrypoint script `scripts/entrypoint.sh` runs with `WORKDIR /app` (and explicitly `cd /app` for robustness).
2. It runs: `alembic upgrade head`
3. Then starts: `uvicorn server:app --host 0.0.0.0 --port 8000`

So after `docker compose up`, the database is migrated to the latest revision without extra commands. For local development, run `alembic upgrade head` yourself before starting the server.

---

## Testing

See **[docs/TESTING.md](TESTING.md)** for how to run backend (pytest) and frontend (Jest + React Testing Library) tests, what is covered, and what to add next.

---

## CI/CD

- **Location**: `.github/workflows/ci.yml`
- **Triggers**: Push and pull requests to `main` or `master`
- **Jobs**:
  1. **Backend**: Checkout → setup Python 3.11 → install `backend/requirements.txt` → run `python -c "from server import app; print('OK')"` (import test). No DB required for this step.
  2. **Frontend**: Checkout → setup Node 20 → install deps (`npm ci`) → `npm run build`

No deployment or secrets are configured; the workflow only validates that the backend imports and the frontend builds.

---

## Health endpoint verification

- **URL**: `GET /api/health`
- **Response**: `200 OK` with JSON, e.g. `{"status": "healthy", "service": "feelathomenow-api", "timestamp": "..."}`

Existing implementation in `backend/server.py` (under `api_router`, prefix `/api`). No duplicate was added. Docker backend healthcheck uses: `curl -f http://localhost:8000/api/health`.
