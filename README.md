# FeelAtHomeNow System

## 1. Project Overview

Multi-tenant SaaS for managing furnished housing operations: properties, units, rooms, tenancies, CRM (tenants and landlords), documents, and operational KPIs. The **database** is the source of truth for tenant isolation; the API and admin UI sit on top.

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React (deployed on **Vercel**) |
| Backend | **FastAPI** (Python) on **Render** |
| Database | **PostgreSQL** on **Render** |
| ORM & migrations | **SQLModel** + **Alembic** |
| Auth | JWT access tokens; **HttpOnly** refresh cookies |
| CI | **GitHub Actions** (pytest, Alembic upgrade, frontend build) |

## 3. Architecture

**Backend** — FastAPI app under `backend/` (API routes, auth, business logic). Uses SQLModel for models and PostgreSQL.

**Frontend** — React app under `frontend/` (admin portal and related UI). Talks to the API over HTTPS.

**Database** — Single PostgreSQL instance. Schema is owned by Alembic migrations, not ad-hoc DDL.

**Multi-tenancy** — Data is partitioned by **`organization_id`**. Isolation is enforced in the database with **Row Level Security (RLS)** on security-sensitive tables (users, audit logs, auth tables, and core tenant-scoped entities). Session-local variables (`SET LOCAL app.current_organization_id`, etc.) align connections with the active tenant.

**RLS** — Policies restrict `SELECT`/`INSERT`/`UPDATE`/`DELETE` so rows are only visible when `organization_id` matches the bound context (or explicit, documented exceptions for auth bootstrap). See [docs/RLS_COVERAGE.md](docs/RLS_COVERAGE.md).

## 4. Local Development Setup

**Prerequisites:** Python 3.11+, Node.js 20+, PostgreSQL 16 (local or Docker).

**Backend**

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
source venv/bin/activate
pip install -r requirements.txt
```

Configure environment (copy from `.env.example` if present in repo; set at least `DATABASE_URL`, `SECRET_KEY`). Run the API, for example:

```bash
uvicorn server:app --reload --port 8001
```

**Frontend**

```bash
cd frontend
npm ci
npm start
```

Point the frontend at your local API URL via the project’s env pattern (see `frontend/.env.example` if available).

**Database tests** — Integration tests that hit PostgreSQL expect `TEST_DATABASE_URL` (see `backend/tests` and CI workflow).

## 5. Migrations (Alembic)

Migrations live in `backend/alembic/versions/`. Apply from `backend/`:

```bash
alembic upgrade head
```

Generate new revisions only after changing models in sync with the team’s migration process. CI runs `alembic upgrade head` against a fresh Postgres service before pytest.

## 6. Security Model (RLS)

- **Enforcement:** PostgreSQL RLS policies; the application role used at runtime must **not** bypass RLS (no superuser, no `BYPASSRLS`).
- **Context:** `db/rls.py` sets transaction-local GUCs (`app.current_organization_id`, `app.current_user_id`, and trusted paths for login/refresh) so each request’s SQL runs under the correct scope.
- **Auth tables:** `user_credentials` and `refresh_tokens` carry `organization_id` and are protected by RLS; inserts require matching org context and row data.
- **Detail:** [docs/RLS_COVERAGE.md](docs/RLS_COVERAGE.md).

## 7. Key Concepts

| Concept | Meaning |
|---------|---------|
| `organization_id` | Foreign key to `organization`; primary tenant boundary for RLS and queries. |
| User | Portal login identity; scoped to one organization. |
| **Tenancy** | Rental agreement linking tenant, room/unit, dates, and status. |
| **Unit / room / property** | Inventory hierarchy for listings and operations. |
| **CRM** | Tenant and landlord records and notes, scoped by organization. |
| **Documents** | Stored metadata and file handling tied to units/tenants as implemented in the API. |

## 8. Documentation

- **[docs/RLS_COVERAGE.md](docs/RLS_COVERAGE.md)** — RLS coverage, auth flows, context variables, migration references (042–044 for auth-related hardening).

## Core Features (product scope)

- Admin portal: properties, units, rooms, operational workflows  
- Co-living and business-apartment use cases  
- Tenant and landlord CRM  
- Document management  
- KPI / operational reporting (backend-driven)  
- Multi-tenant SaaS deployment model (organization isolation + RLS)
