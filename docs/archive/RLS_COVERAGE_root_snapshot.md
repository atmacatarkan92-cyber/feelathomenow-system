# RLS coverage (PostgreSQL)

Source: migrations `023_rls_unit_tenant_room.py`, `025_rls_core_tables.py`, `030_rls_tenant_crm.py`, `042_rls_users_audit_logs.py`. Policies compare `organization_id` (or parent `unit`) to `current_setting('app.current_organization_id', true)` — see migration header comments for UUID/VARCHAR text matching.

**FORCE ROW LEVEL SECURITY:** `023` uses `FORCE` on `unit`, `tenant`, `room`. `042` uses `FORCE` on `users` and `audit_logs`. Other core tables from `025` use `ENABLE` + policies without `FORCE` (table owner still subject to RLS when not superuser).

## Core tables

| Table | RLS enabled | FORCE RLS | Policy type |
|-------|-------------|-----------|-------------|
| `invoices` | yes | no | `org_isolation_invoices` — `organization_id` matches session GUC (`FOR ALL`, `USING` / `WITH CHECK`) |
| `landlords` | yes | no | `org_isolation_landlords` — same direct `organization_id` pattern |
| `tenancies` | yes | no | `org_isolation_tenancies` — same direct `organization_id` pattern |
| `properties` | yes | no | `org_isolation_properties` — same direct `organization_id` pattern |
| `unit_costs` | yes | no | `org_isolation_unit_costs` — **no `organization_id` column**; isolation via `EXISTS` subquery on `unit` where `unit.id = unit_costs.unit_id` and `unit.organization_id` matches GUC (`FOR ALL`, `USING` / `WITH CHECK`) |
| `users` | yes | yes | `org_isolation_users` — org match via GUC; self-row via `app.current_user_id`; trusted auth email lookup via `app.auth_unscoped_user_lookup` (login/forgot-password only; see `backend/db/rls.py`) |
| `audit_logs` | yes | yes | `org_isolation_audit_logs` — direct `organization_id` (backfilled in `042`; application sets on insert via `create_audit_log`) |

## Policy pattern

- **Direct org columns:** `tenancies`, `invoices`, `properties`, `landlords`, `audit_logs` — row `organization_id::text = current_setting('app.current_organization_id', true)`.
- **Indirect:** `unit_costs` — parent `unit.organization_id` must match the same GUC.
- **users:** additionally `id::text = current_setting('app.current_user_id', true)` for bootstrap before org GUC is set, and `current_setting('app.auth_unscoped_user_lookup', true) = 'true'` only in trusted auth routes (SET LOCAL).

Application-side GUC binding: `backend/db/rls.py` (`apply_pg_organization_context`, `apply_pg_user_context`, `apply_pg_auth_unscoped_user_lookup`, `Session.after_begin`).
