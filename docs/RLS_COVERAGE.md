# RLS_COVERAGE.md

## Status

**Production: ACTIVE**  
**Last Updated:** 2026-03-27  
**Scope:** Multi-tenant data isolation (operational CRM, auth, marketing/listings, inquiries, password-reset tokens)

---

## Overview

PostgreSQL **Row Level Security (RLS)** is enabled on tenant-bound and security-sensitive tables. Policies are **fail-closed** when `app.current_organization_id` is unset, except where explicitly documented (public marketing reads, trusted auth paths, anonymous contact intake).

The application still applies org filters in routes; RLS is the **database-level backstop** if a query omits a `WHERE` clause.

---

## RLS Context Variables (GUCs)

| Variable | Purpose |
| -------- | ------- |
| `app.current_organization_id` | Primary tenant scope for most policies |
| `app.current_user_id` | Bootstrap: own `users` row before org is known |
| `app.auth_unscoped_user_lookup` | Trusted: login / forgot-password user lookup by email |
| `app.current_refresh_token_hash` | Trusted: resolve `refresh_tokens` before org is known |
| `app.current_password_reset_token_hash` | Trusted: resolve `password_reset_tokens` before org is known |
| `app.current_inquiry_id` | Trusted: single-row `inquiries` access (e.g. background email task) |

Helpers: `backend/db/rls.py` (`apply_pg_*`).

---

## Covered Tables (by pattern)

### A) Direct `organization_id` column

| Table | Policy name | FORCE RLS | Notes |
| ----- | ----------- | --------- | ----- |
| `users` | `org_isolation_users` | yes | + unscoped / `current_user_id` paths (migration 042) |
| `audit_logs` | `org_isolation_audit_logs` | yes | 042 |
| `user_credentials` | `org_isolation_user_credentials` | yes | + `auth_unscoped_user_lookup` (044) |
| `refresh_tokens` | `org_isolation_refresh_tokens` | yes | + `current_refresh_token_hash` (044) |
| `unit`, `tenant`, `room` | `org_isolation_*` | yes | 023 |
| `tenancies`, `invoices`, `properties`, `landlords` | `org_isolation_*` | no FORCE | 025 |
| `unit_costs` | `org_isolation_unit_costs` | no | via parent `unit` (025) |
| `tenant_notes`, `tenant_events` | `org_isolation_*` | yes | 030 |
| `property_managers` | (per 036) | | |
| `unit_documents`, `tenant_documents` | (per 037/039) | | |

### B) Join-based (no `organization_id` on row — parent supplies scope)

| Table | Policy name | FORCE RLS | Mechanism |
| ----- | ----------- | --------- | --------- |
| `listings` | `listings_org_or_published` | yes | `EXISTS (unit WHERE unit.id = listings.unit_id AND org match)` **OR** published listing readable without org GUC (public API) |
| `listing_images` | `listing_images_org_or_published` | yes | Via `listings` → `unit`; read also allows published parent |
| `listing_amenities` | `listing_amenities_org_or_published` | yes | Same as `listing_images` |

**Public marketing:** `listings.is_published = true` rows are readable with **no** tenant GUC (intentional cross-tenant public catalog). Writes require org context via `WITH CHECK` (tenant path only).

### C) `inquiries` (mixed)

| Column / rule | Purpose |
| ------------- | ------- |
| `organization_id` (nullable, FK → `organization`) | Denormalized tenant; backfilled from `listings` → `unit` where `apartment_id` set (migration **045**) |
| Policy `inquiries_access` | **USING:** org match; OR anonymous rows (`organization_id` and `apartment_id` NULL) when org GUC unset; OR `app.current_inquiry_id` trusted row |
| **WITH CHECK** | Anonymous insert (`both NULL`); or listing-linked insert with `organization_id` matching `listings`/`unit` org |

Anonymous web contact rows remain **admin-invisible** in org-scoped list endpoints (application query unchanged).

### D) `password_reset_tokens`

| Policy | FORCE RLS | Mechanism |
| ------ | --------- | --------- |
| `org_isolation_password_reset_tokens` | yes | `EXISTS (users u WHERE u.id = user_id AND u.organization_id matches GUC)` **OR** `token_hash = app.current_password_reset_token_hash` |

Forgot-password inserts set org context **per user** before insert (`auth/routes.py`). Reset endpoint uses `apply_pg_password_reset_token_hash_lookup` for the initial lookup.

---

## Migration Summary

| Migration | Description |
| --------- | ----------- |
| 023 | RLS: `unit`, `tenant`, `room` |
| 025 | RLS: core business tables |
| 030 | RLS: tenant CRM |
| 036–039 | RLS: property managers, documents |
| 042 | RLS: `users`, `audit_logs` |
| 043–044 | Auth table columns + RLS: `user_credentials`, `refresh_tokens` |
| **045** | RLS: `listings`, `listing_images`, `listing_amenities`, `inquiries`, `password_reset_tokens` |

---

## Verification

- Runtime DB role must be **non-superuser** and **not** `BYPASSRLS` (see `docs/DEVOPS.md`, `tests/test_rls.py`).
- Policy inventory: `tests/test_rls.py` (`test_rls_environment_validates_database_role_and_policies`).

---

## Remaining / operational notes

- **Reference tables** (e.g. `cities`) are not tenant-scoped; listings reference them by FK only.
- **Backups / `pg_dump`:** use a role appropriate for your backup strategy; do not weaken RLS to dump (see `docs/archive/database-backups.md`).
