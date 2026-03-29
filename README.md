# FeelAtHomeNow Platform

Multi-tenant SaaS platform for managing furnished housing and co-living operations.

FeelAtHomeNow replaces fragmented spreadsheets and disconnected tools with a single system for managing inventory, tenancies, CRM, invoicing, and operational reporting.  
It is built for property operators who require strict organization-level data isolation and a unified workflow for staff, tenants, and landlords.

---

## Overview

The system delivers **organization-scoped** property operations and financial visibility. The **PostgreSQL** database is the source of truth for tenant isolation and business data. The **FastAPI** backend exposes REST APIs; the **React** frontend provides the operator UI. Authentication uses **JWT** access tokens (Bearer) and **HttpOnly** refresh cookies. **Row Level Security (RLS)** enforces isolation in the database for sensitive and tenant-bound tables, complementing application-level filters.

**Typical deployment:** React on **Vercel**, API on **Render**, PostgreSQL on **Render**. CI runs on **GitHub Actions** (Alembic migrations, pytest against PostgreSQL, frontend install/build).

---

## Core Features

| Area | Description |
|------|-------------|
| Admin operations | Properties, units, rooms, listings, tenancies, invoices, dashboard KPIs |
| CRM | Tenant and landlord records and related workflows |
| Documents | Unit and tenant document flows (API-backed storage) |
| Portals | Tenant and landlord APIs scoped to the authenticated user’s role and data |
| Public listings | Published listings for marketing (read-only, non-admin) |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React (production: **Vercel**) |
| Backend | **FastAPI** (Python; production: **Render**) |
| Database | **PostgreSQL** (production: **Render**) |
| Data access | **SQLModel** (SQLAlchemy ORM) with **psycopg2** driver |
| Schema changes | **Alembic** (`backend/alembic/versions/`) |
| Auth | JWT access tokens; **HttpOnly** refresh token cookies |
| CI | **GitHub Actions** (Alembic `upgrade head`, pytest, frontend `npm ci` / build) |

---

## Architecture

| Component | Role |
|-----------|------|
| **Frontend** (`frontend/`) | React SPA: admin and related UI; calls the API over HTTPS |
| **Backend** (`backend/`) | FastAPI entrypoint `server.py`; routes under `app/api/v1/`; services under `app/services/`; auth under `auth/` |
| **Database** | Single PostgreSQL instance; schema owned by **Alembic** (production does not rely on ad-hoc `create_all`) |
| **Local stack** | Optional `docker-compose.yml` at repo root (Postgres, backend, frontend) for integrated local runs |

Request flow: browser → API → SQLAlchemy `Session` → PostgreSQL. Authenticated requests bind **tenant context** via `db/rls.py` (transaction-local `SET LOCAL` and session hooks) so RLS policies evaluate correctly.

---

## Multi-Tenancy and Security

- **Tenant boundary:** `organization_id` on scoped rows, aligned with an `organization` record.
- **Defense in depth:** Admin routes use dependencies such as `get_current_organization` with explicit filters; **RLS** restricts which rows the application database role can read or write even if an application bug omits a `WHERE` clause.
- **RLS scope:** Enforced on security-sensitive and core tenant tables (including `users`, `audit_logs`, `user_credentials`, `refresh_tokens`, and business entities introduced across migrations **023**, **025**, **030**, **042**, **043**, **044**). Exact policy names and GUCs are documented in [docs/RLS_COVERAGE.md](docs/RLS_COVERAGE.md).
- **Runtime role:** The app must connect as a role that is **not** superuser and **not** `BYPASSRLS`, or RLS does not apply as intended.

---

## Local Development Setup

**Requirements:** Python 3.11+, Node.js 20+, PostgreSQL 16 (local or Docker). Configure `SECRET_KEY` and a PostgreSQL URL for the **application** database user (not a superuser) so RLS applies — see [docs/DEVOPS.md](docs/DEVOPS.md) for Docker split roles (`MIGRATE_DATABASE_URL` vs `DATABASE_URL`).

**Backend**

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

**Frontend**

```bash
cd frontend
npm ci
npm start
```

Point the frontend at your API base URL using `frontend/.env` / `frontend/.env.example` as applicable.

**Integration tests** that exercise PostgreSQL and RLS expect `TEST_DATABASE_URL` (see `backend/tests` and `.github/workflows/ci.yml`).

---

## Migrations

Alembic migrations live in `backend/alembic/versions/`. Apply from the `backend/` directory using a **privileged** connection (or set `MIGRATE_DATABASE_URL` when `DATABASE_URL` is the app role only):

```bash
cd backend
alembic upgrade head
```

New revisions should follow the team’s migration process. CI and Docker run migrations with a migration user, then `scripts/ci_grant_app_role.py`, then tests or the API with the app user — see [docs/DEVOPS.md](docs/DEVOPS.md).

---

## Security Model (RLS)

PostgreSQL **Row Level Security** policies compare row data (typically `organization_id`) to **session-level settings** set for each transaction, e.g. `app.current_organization_id` and, where needed, `app.current_user_id`. Auth flows use additional **trusted**, short-lived settings for login and refresh-token resolution (see `backend/db/rls.py` and [docs/RLS_COVERAGE.md](docs/RLS_COVERAGE.md)).

- **Enforcement:** Policies use `USING` / `WITH CHECK`; sensitive tables may use **FORCE ROW LEVEL SECURITY** so policies apply even to the table owner.
- **Application code:** `db/rls.py` centralizes `SET LOCAL` via helpers and `Session.after_begin` so context survives commits within a session where designed.

`user_credentials` and `refresh_tokens` include `organization_id` (migration **043**) and RLS (**044**); inserts and queries must run with matching context as described in the linked docs.

---

## Key Concepts

| Concept | Meaning |
|---------|---------|
| `organization_id` | Foreign key to `organization`; primary tenant boundary for queries and RLS |
| User | Portal account; scoped to one organization |
| Tenancy | Contract linking tenant, room/unit, dates, and status |
| Unit / room / property | Inventory hierarchy for listings and operations |
| CRM | Tenant and landlord records and notes, scoped by organization |
| Documents | Metadata and file handling for units/tenants via the API |

---

## Documentation

| Document | Contents |
|----------|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, request lifecycle, RLS context, testing notes |
| [docs/RLS_COVERAGE.md](docs/RLS_COVERAGE.md) | RLS tables, auth flows, GUC reference, migration summary (e.g. 042–044) |
| [docs/DEVOPS.md](docs/DEVOPS.md) | Deployment and operations notes |

Historical and phase-specific documents are under [docs/archive/](docs/archive/).

---

## Status

The platform is **in active development** with production-style deployment targets (Vercel, Render, managed PostgreSQL). Schema evolution is **migration-driven**; RLS and multi-tenancy are **first-class** concerns for new features and reviews.

---

## Vision

Deliver a **reliable, auditable** operations platform where **tenant isolation is enforced in the database**, APIs remain **explicit and reviewable**, and operators get **accurate** inventory, CRM, and financial signals without sacrificing security for speed.
