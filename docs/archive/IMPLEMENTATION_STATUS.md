# CURRENT IMPLEMENTATION STATUS

Based on the actual codebase only. No target architecture or planned features described as existing.

---

## 1. Fully implemented and working

- **PostgreSQL models (db/models.py)**  
  Unit, Room, Tenant, Tenancy, TenancyStatus, City, Listing, ListingImage, ListingAmenity, Inquiry, UnitCost, User, UserCredentials, UserRole are defined. Unit has `title`, `address`, `city`, `rooms`, `type`, `city_id`, `created_at`. Room has `unit_id`, `name`, `price`, `floor`, `is_active`. Tenancy has FKs to tenant, room, unit; move_in_date, move_out_date, rent_chf, status.

- **Admin Units API**  
  GET/POST/PATCH/DELETE `/api/admin/units`, GET `/api/admin/units/{id}`, GET `/api/admin/units/{id}/rooms`. Implemented in `app/api/v1/routes_admin_units.py`. Uses SQLModel Unit/Room; list returns `[]` when empty; schema errors return 503 with migration hint.

- **Admin Rooms API**  
  GET/POST/PATCH/DELETE `/api/admin/rooms` in `routes_admin_rooms.py`. GET by unit lives under units router. Room has no FK to unit in the model (only `unit_id` index).

- **Admin Tenants API**  
  Full CRUD at `/api/admin/tenants` in `routes_admin_tenants.py`.

- **Admin Tenancies API**  
  GET/POST/PATCH/DELETE `/api/admin/tenancies`, GET `/api/admin/rooms/{room_id}/tenancies` in `routes_admin_tenancies.py`. Validation: tenant/room/unit exist, room belongs to unit, no overlapping tenancies.

- **Auth**  
  JWT login (`POST /auth/login`), `GET /auth/me`, role-based protection. Admin token in `localStorage` (e.g. `fah_admin_token`). Swagger Bearer support.

- **Public listings (apartments)**  
  `GET /api/apartments` and `GET /api/apartments/{id}` use PostgreSQL when `engine` is set (via `app/services/listings_service.py`); otherwise fallback to Airtable. Frontend (`ApartmentsPage`, `ApartmentDetailPage`) calls these endpoints.

- **Admin Listings**  
  CRUD at `/api/admin/listings`, PATCH `/api/admin/listings/{id}/status` (is_published, availability_status). Listings link to unit (and optional room) and city.

- **Invoices (read + status)**  
  `GET /api/invoices` (raw SQL in server.py), `PUT /api/invoices/{id}/status`, `PATCH .../mark-paid`, `PATCH .../mark-unpaid`. Table has no SQLModel; columns include paid_at, payment_method, payment_reference (optional migration). Effective status: unpaid / paid / overdue.

- **Invoice generation from tenancies**  
  `POST /api/admin/invoices/generate` with body `{ year, month }`. Implemented in `app/services/invoice_generation_service.py`: active tenancies overlapping month, prorated amount, duplicate check by tenancy_id + billing_year + billing_month. Requires `ensure_invoice_tenancy_columns` (tenant_id, tenancy_id, room_id, unit_id, billing_year, billing_month).

- **Occupancy / revenue / profit backend**  
  `app/services/occupancy_service.py` (room status, unit occupancy), `app/services/revenue_forecast.py`, `app/services/profit_service.py`. Endpoints: GET `/api/admin/occupancy`, GET `/api/admin/occupancy/rooms`, GET `/api/admin/revenue-forecast`, GET `/api/admin/profit`, GET `/api/admin/invoice-summary`.

- **App.js refactor**  
  `App.js` only mounts `BrowserRouter` + `LanguageProvider` + `AppRouter`. No page logic there.

- **Routing**  
  All routes in `src/routes/AppRouter.jsx` (public + admin under `/admin` with `AdminLayout`). Lazy-loaded public pages; admin pages imported directly.

- **Contact / inquiries**  
  POST `/api/contact` and GET `/api/admin/inquiries` use PostgreSQL `Inquiry` model. No MongoDB in use.

---

## 2. Partially implemented / mixed

- **Units/Rooms – frontend**  
  Admin pages load units/rooms from API (`fetchAdminUnits`, `fetchAdminRooms` from `adminData.js`): AdminApartmentsPage, AdminRoomsPage, AdminUnitDetailPage, AdminCoLivingDashboardPage, AdminOccupancyPage, AdminForecastPage, AdminTenantsPage, AdminUebersichtPage, AdminListingsPage (units + rooms for form), AdminBreakEvenPage, AdminExpensesPage, AdminPerformancePage, AdminBusinessApartmentsDashboardPage. No remaining `fah_units`/`fah_rooms` in those flows.

- **Tenants page – tenancies and invoices**  
  AdminTenantsPage loads units, rooms, tenants from API. Tenancies and invoices still come from `localStorage` (`fah_tenancies`, `fah_invoices`) with fallback to `getFallbackTenancies()`. So tenant list is from API; per-tenant tenancy and invoice data are not from backend.

- **Tenancies – frontend**  
  No `fetchAdminTenancies()` in `adminData.js`. Admin UI does not call GET `/api/admin/tenancies` to display or manage tenancies; tenancy data on AdminTenantsPage is localStorage/fallback.

- **Dashboard overview (AdminUebersichtPage)**  
  Units/rooms from API; profit from `fetchAdminProfit`; invoices from GET `/api/invoices`. Co-living metrics (occupied/reserved/free) come from `getCoLivingMetrics(unit, rooms)` using `room.status` — and `normalizeRoom` sets status from `r.is_active` (“Frei”/“Inaktiv”), not from tenancies. So overview occupancy is not from occupancy API.

- **Co-Living dashboard (AdminCoLivingDashboardPage)**  
  Uses `fetchAdminOccupancy`, `fetchAdminRevenueForecast`, `fetchAdminOccupancyRooms` and merges with local `getCoLivingMetricsForMonth`; has OccupancyMap. Still mixes API occupancy with local room-based metrics (e.g. vacancy days from room.status).

- **Invoices table**  
  No SQLModel; all access via raw SQL in server.py. Schema depends on migrations: `ensure_invoice_payment_columns` (paid_at, payment_method, payment_reference), `ensure_invoice_tenancy_columns` (tenant_id, tenancy_id, room_id, unit_id, billing_year, billing_month). GET /invoices does not return tenancy_id/billing_month etc.; frontend only sees id, invoice_number, amount, status, dates, paid_at, payment_method, payment_reference.

- **Landlords / Property managers**  
  AdminLandlordsPage and AdminPropertyManagersPage read from `localStorage` (`fah_landlords`, `fah_property_managers`). No backend APIs for these entities.

- **AdminUebersichtPage “Schnellzugriff”**  
  Uses `loadSavedArray(key)` for some keys (localStorage) for quick-access data.

---

## 3. Still transitional / risky

- **Unit table schema**  
  If DB was created before current model, table can lack `type`, `city_id`, `created_at`. Migration: `ensure_units_rooms_tenants_columns.py`. Without it, GET `/api/admin/units` can 500 (or 503 after recent defensive handling).

- **Room.unit_id**  
  In `db/models.py`, Room has `unit_id: str = Field(index=True)` with no `foreign_key="unit.id"`. So referential integrity is not enforced by the current model; if the table was created by an older migration or manually, behavior may vary.

- **Legacy billing_service.py**  
  `services/billing_service.py` uses a different tenancy schema (start_date, end_date, monthly_rent, billing_cycle) and a `billing_runs` table. It is not used by the main app or by POST `/api/admin/invoices/generate` (which uses `app/services/invoice_generation_service.py`). If anyone runs or tests the old billing_service against the current DB, it will fail (column names differ). Same for `seed_billing_data.py` (references old tenancy columns).

- **Invoice generation preconditions**  
  Generation expects `invoices` to have tenant_id, tenancy_id, room_id, unit_id, billing_year, billing_month. If `ensure_invoice_tenancy_columns` was not run, generation will fail.

- **PDF generation**  
  Invoice PDF path still uses `invoices/{invoice_number}.pdf` and `generate_invoice_pdf` in `pdf/invoice_pdf.py`. Newly generated invoices (from invoice_generation_service) do not call PDF generation in the current code; only invoice rows and numbers are created.

---

## 4. Likely next bugs or weak points

- **AdminTenantsPage**  
  Tenancies and invoices from localStorage; if another tab/user creates tenancies or invoices via API, this page will not show them. Deleting or not using localStorage can make the page empty or fall back to fake data.

- **AdminUebersichtPage occupancy**  
  Co-living stats are from room status (Frei/Inaktiv), not from tenancies. With real tenancy data, overview will not match occupancy API or Co-Living dashboard unless this page is switched to occupancy API.

- **Invoices table**  
  No single migration that creates the table; it may have been created by an older system or manually. All new columns are additive (payment, tenancy). If the table was created with a different primary key or without expected columns, both GET /invoices and invoice generation can break.

- **Landlords / property managers**  
  Purely localStorage; no API, no PostgreSQL. Any “admin” view of them is not shared or persistent.

- **Unit/Room/Tenant table names**  
  Model uses `__tablename__ = "unit"`, `"room"`, `"tenant"` (singular). Any script or manual schema using plural names will not match.

- **fetchAdminRooms(null)**  
  `adminData.js` `fetchAdminRooms(unitId = null)` calls GET `/api/admin/rooms` when unitId is null. That endpoint exists and returns all rooms; behavior is consistent.

---

## 5. Recommended next 5 actions in correct order

1. **Wire AdminTenantsPage to tenancies and invoices API**  
   Add `fetchAdminTenancies()` (and optionally a dedicated invoices list or reuse GET /api/invoices) in `adminData.js`. Load tenancies (and invoices) from API in AdminTenantsPage; remove dependency on `fah_tenancies` and `fah_invoices` (and fallback) so the tenant list reflects backend data.

2. **Use occupancy API on AdminUebersichtPage**  
   Replace or supplement `getCoLivingMetrics(unit, rooms)` with `fetchAdminOccupancy()` (and optionally `fetchAdminOccupancyRooms`) so overview KPIs (occupied/reserved/free) match the tenancy-based occupancy API and other dashboards.

3. **Run and document migrations**  
   Ensure every environment runs: `ensure_units_rooms_tenants_columns`, `ensure_invoice_payment_columns`, `ensure_invoice_tenancy_columns`, `fix_listing_availability_column` (if listings use availability_status). Add a single “schema readiness” script or doc that lists and runs them in order.

4. **Optional: Invoice PDF for generated invoices**  
   In `app/services/invoice_generation_service.py`, after creating an invoice row, call the existing PDF generator (or a shared helper) so generated invoices also get a PDF file, consistent with the old billing flow.

5. **Remove or isolate legacy billing code**  
   Either delete or clearly mark as unused `services/billing_service.py` and `seed_billing_data.py` (and any tests that depend on the old tenancy schema), so no one runs them against the current tenancies table.

---

*Generated from the current codebase. Re-check after changes.*
