# Production-Ready SaaS Improvements

This document outlines prioritized improvements to make FeelAtHomeNow production-ready as a SaaS.

## Already implemented (in this repo)

- **Backend**: PostgreSQL URL from env (`DATABASE_URL` or `PG_*`); optional `ADMIN_API_KEY` for admin/invoice endpoints; `/api/ready` readiness check; dependencies added to `requirements.txt` (sqlalchemy, sqlmodel, psycopg2-binary).
- **Frontend**: Central `src/config.js` with `API_BASE_URL` and `getApiHeaders()`; all API calls use it (no hardcoded `127.0.0.1:8000`); PDF download uses fetch + blob so it works with API key.
- **Config**: `backend/.env.example` and `frontend/.env.example`; `backend/Dockerfile` for containerized deploy.

---

## 1. Security (Critical)

### 1.1 Authentication & Authorization

- **Admin & invoice API**: Add authentication to all sensitive endpoints:
  - `GET/PUT /api/invoices`, `GET /api/invoices/{id}/pdf`, `GET /api/admin/inquiries`
- **Options**:
  - **API keys** (simplest): Header `X-API-Key` validated against env `ADMIN_API_KEY`; rotate per environment.
  - **JWT**: Admin login (separate endpoint or external IdP); validate Bearer token in FastAPI dependency.
  - **SSO / OAuth**: If you need “login with Google/Microsoft” for admin, integrate an OAuth2 provider; validate tokens in a dependency and attach user/role to request.
- **Recommendation**: Start with API key for admin/invoices; add JWT or SSO when you introduce an admin login UI.

### 1.2 Secrets & Configuration

- **No hardcoded credentials**: Move PostgreSQL URL to environment (e.g. `DATABASE_URL` or `PG_HOST`, `PG_USER`, `PG_PASSWORD`, `PG_NAME`). Use a secrets manager (e.g. AWS Secrets Manager, Doppler) in production.
- **Frontend**: Never expose API keys or secrets in client bundles. Use `REACT_APP_*` / `VITE_*` only for non-sensitive config (backend URL, public feature flags).

### 1.3 CORS & Headers

- Set `CORS_ORIGINS` to explicit frontend origins (e.g. `https://app.yourdomain.com,https://admin.yourdomain.com`). Avoid `*` in production.
- Add security headers (e.g. Helmet on frontend; FastAPI middleware for `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` if behind HTTPS).

### 1.4 Input Validation & Rate Limiting

- You already use Pydantic for contact form; ensure all API inputs are validated and lengths/values constrained.
- Add rate limiting (e.g. `slowapi` or nginx/cloud) on `/api/contact` and admin endpoints to prevent abuse and DDoS.

---

## 2. Configuration & Environment

### 2.1 Single Source of Truth

- **Backend**: One `.env.example` listing every variable (with dummy values and comments). Load via `python-dotenv`; validate required vars at startup and fail fast with a clear message.
- **Frontend**: Single module (e.g. `src/config.js`) that reads `process.env.REACT_APP_API_URL` and exports `API_BASE_URL`. Use it everywhere instead of hardcoded `http://127.0.0.1:8000`.
- **tenant-app**: Keep Base44 config in env (`VITE_BASE44_APP_ID`, etc.); ensure production builds use production Base44 app/base URL.

### 2.2 Multi-Environment

- Support `development`, `staging`, `production` (e.g. `APP_ENV` or `NODE_ENV`). Use different Airtable bases, DBs, and API URLs per environment. Document in README.

---

## 3. Database

### 3.1 PostgreSQL

- **Schema as code**: Define an `Invoice` (and related) model or use migrations (Alembic) so the schema is reproducible. Provide a migration that creates `invoices`, `tenancies`, `billing_runs` if they don’t exist.
- **Connection handling**: Use connection pooling; avoid creating a new engine per request. For async FastAPI, consider `asyncpg` + SQLAlchemy 2 async or run sync DB calls in `run_in_executor` so the event loop isn’t blocked.
- **Credentials**: Always from env; never in code.

### 3.2 MongoDB

- Keep using Motor for async; ensure `MONGO_URL` uses auth and TLS in production. Optionally use a single replica set for production.

### 3.3 Airtable

- Treat as external config; use separate bases or tables per environment. Document required fields and any webhook/sync if you add automation.

---

## 4. Observability & Reliability

### 4.1 Logging

- Structured logging (JSON in production): include `request_id`, `path`, `status`, `duration`, `error` (message only, no stack in client-facing responses). Use a single logger per service; avoid `print()`.
- Log levels: `DEBUG` in dev, `INFO` in prod; `WARNING`/`ERROR` for failures and auth issues.

### 4.2 Health & Readiness

- **Liveness**: `GET /api/health` returns 200 (already exists).
- **Readiness**: Add `GET /api/ready` that checks MongoDB (and optionally PostgreSQL and Airtable). Return 503 if any required dependency is down so orchestrators don’t send traffic.

### 4.3 Error Handling

- Backend: Global exception handler; map exceptions to consistent JSON (`code`, `message`, `request_id`). Don’t leak stack traces or DB details in production.
- Frontend: Centralized API client (e.g. `fetch` wrapper or axios instance) that uses `API_BASE_URL`, handles 4xx/5xx, and surfaces user-friendly messages or toasts.

### 4.4 Metrics & APM (Optional)

- Expose Prometheus metrics (request count, latency, errors by path) or integrate an APM (e.g. Sentry, Datadog). Use for alerts and capacity planning.

---

## 5. API Design

### 5.1 Versioning

- Prefix routes with version: e.g. `/api/v1/apartments`, `/api/v1/contact`. Keeps backward compatibility when you change contracts.

### 5.2 Idempotency & Consistency

- For `PUT /api/invoices/{id}/status`, validate `status` against an allowed set (e.g. `open`, `sent`, `paid`, `overdue`, `cancelled`). Return 400 for invalid values.
- Document response shapes (OpenAPI is already generated by FastAPI; keep it updated and consider publishing it).

---

## 6. Frontend

### 6.1 API Client

- One module that builds the base URL from env and exports `get`, `post`, `put` helpers (or axios instance). Use in all admin and public API calls. Handle network errors and 5xx with retries or user message.

### 6.2 Error Boundaries

- Add React error boundaries around major sections (e.g. admin layout, tenant-app layout) so a single component failure doesn’t blank the whole app.

### 6.3 Duplicate Router

- Remove the inner `<BrowserRouter>` in `frontend/src/App.js`; use a single router at the top level.

---

## 7. Deployment & DevOps

### 7.1 Containers

- **Backend**: Dockerfile that installs deps, copies app, runs `uvicorn` with host `0.0.0.0` and configurable port. Use non-root user.
- **Frontend**: Build with `yarn build`; serve static files with nginx or a simple server. Optionally multi-stage Dockerfile (build stage + nginx serve).
- **tenant-app**: Same idea; ensure env is injected at build time for `VITE_*` if needed.

### 7.2 Orchestration

- Use a single `docker-compose.yml` for local dev (backend, frontend, MongoDB, PostgreSQL). For production, use Kubernetes, ECS, or a PaaS (e.g. Render, Railway) with env and secrets configured.

### 7.3 CI/CD

- Pipeline: lint → test → build. Run backend tests (pytest) and frontend build (and optionally tests). Deploy only from main/release branch; use different envs for staging vs production.

### 7.4 Dependencies

- Backend: Add missing packages to `requirements.txt`: `sqlalchemy`, `sqlmodel`, `psycopg2-binary` (or `asyncpg` if you go async). Pin versions and refresh periodically.
- Frontend: Audit for vulnerabilities (`yarn audit`); fix or document accepted risks.

---

## 8. SaaS-Specific (Multi-Tenancy & Billing)

### 8.1 Tenant Isolation

- If multiple “companies” or properties use the same stack, introduce a `tenant_id` (or `organization_id`) in MongoDB and PostgreSQL. Scope all queries and APIs by tenant; enforce in a shared dependency (e.g. FastAPI dependency that resolves tenant from JWT or subdomain).

### 8.2 Billing / Invoicing Unification

- You have two invoice flows: FastAPI + PostgreSQL (admin) and Base44 (tenant-app). Decide on one source of truth:
  - **Option A**: Migrate admin invoice UI to Base44 and deprecate FastAPI invoice endpoints.
  - **Option B**: Keep FastAPI as the system of record; have tenant-app call your backend (with auth) for invoice read-only or status updates.
- Document the chosen flow and add integration tests.

### 8.3 Feature Flags & Limits

- Use feature flags (env or service) for experimental features. If you have plans/subscription tiers, enforce limits (e.g. max units per tenant) in the API and surface clear errors.

---

## 9. Checklist Summary

| Area            | Action |
|-----------------|--------|
| Security        | Add auth (API key or JWT) to admin/invoice endpoints; move secrets to env; tighten CORS; add rate limiting. |
| Config          | Backend and frontend config from env only; single API base URL module; .env.example for all apps. |
| Database        | PostgreSQL URL from env; schema via migrations; no blocking DB in async path (pool/executor). |
| Observability   | Structured logging; readiness endpoint; centralized API error handling. |
| API             | Optional version prefix; validate invoice status enum; document OpenAPI. |
| Frontend        | Single router; error boundaries; centralized API client. |
| Deployment      | Dockerfiles for backend and frontend; docker-compose for local; CI lint/test/build. |
| SaaS            | Tenant isolation if multi-tenant; single invoice system of record; feature flags/limits. |

Implementing these in the order above (security and config first, then database and observability, then deployment and SaaS features) will put the project in a strong position for production SaaS use.
