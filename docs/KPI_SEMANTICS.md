# KPI Semantics — Business Truth

This document defines how financial and operational KPIs **must** be interpreted for dashboards, reporting, and automated tests. All definitions are scoped to a single **organization** (`organization_id`) unless stated otherwise.

---

## 1. Overview

The system tracks:

| Area | Meaning |
|------|---------|
| **Units & rooms** | A **unit** is a rentable property slice (building / floor group). **Rooms** are bookable spaces inside a unit; occupancy and rent are modeled at **room + tenancy** level. |
| **Tenancies** | A contract linking a **tenant** to a **room** (and **unit**) for a date range, with contractual rent (`rent_chf`). |
| **Invoices** | Billing records (`amount`, dates, status) tied to org, and optionally tenant, tenancy, room, unit. |
| **Unit costs** | Recurring or one-off costs **per unit** (`unit_costs`), stored as a monthly CHF amount. |

KPIs support:

- **Admin dashboard** — period revenue/cost/profit, per-unit performance, trends, break-even style checks.
- **Profitability** — revenue minus costs at unit and org level.
- **Occupancy** — how fully rooms are utilized over time (snapshot and prorated month views).

---

## 2. Core Entities

### 2.1 Unit (`unit`)

| | |
|--|--|
| **Represents** | One managed property / co-living unit under an organization. |
| **KPI-relevant fields** | `id`, `organization_id`, `rooms` (count hint only; **operational room count** uses **active `room` rows** for the unit). |

**Note:** KPI logic that needs “how many rooms” uses **`room` where `unit_id` = unit and `is_active` = true**, not only `unit.rooms`.

---

### 2.2 Room (`room`)

| | |
|--|--|
| **Represents** | A single bookable space inside a unit. |
| **KPI-relevant fields** | `id`, `unit_id`, `is_active`, `price` (list/reference; **contractual rent** for KPIs comes from **tenancy** when present). |

---

### 2.3 Tenancy (`tenancies`)

| | |
|--|--|
| **Represents** | Occupancy and contractual rent for a tenant in a specific room for a period. |
| **KPI-relevant fields** | `organization_id`, `unit_id`, `room_id`, `tenant_id`, `move_in_date`, `move_out_date` (nullable), `rent_chf`, `status` (`active` \| `ended` \| `reserved`). |

**Operational rule (database):** Overlapping date ranges for the same `unit_id` are **invalid** (exclusion constraint). Overlap at **room** level should not occur in normal data; if it does, behavior is undefined until data is corrected.

---

### 2.4 Invoice (`invoices`)

| | |
|--|--|
| **Represents** | An issued bill; **cash-recognition** and **recognized revenue** for accounting-style KPIs use this table. |
| **KPI-relevant fields** | `organization_id`, `amount`, `currency`, `status`, `issue_date`, `due_date`, `paid_at`, optional `billing_year` / `billing_month`, links `tenant_id`, `tenancy_id`, `room_id`, `unit_id`. |

**Statuses** (string, max 32): includes at least `unpaid`, `paid`, `open`, `overdue`, `cancelled` (see model). Which statuses count toward “recognized revenue” must be fixed in policy (see §6).

---

### 2.5 Unit cost (`unit_costs`)

| | |
|--|--|
| **Represents** | A cost line attached to a **unit** (e.g. mortgage, utilities, cleaning). |
| **KPI-relevant fields** | `unit_id`, `cost_type`, `amount_chf`, `created_at`. |

**Semantic:** `amount_chf` is treated as a **recurring monthly** cash outflow for P&amp;L-style **month** calculations unless the product later introduces explicit effective-from/to dates (currently **not** on the row). One-off costs are still stored as rows; without a period flag, they are **indistinguishable** from monthly recurring costs in the schema — see §6.

---

## 3. KPI Definitions

Unless noted, **currency** is CHF; **period** is a calendar month `(year, month)` with bounds `[first_day, last_day]` inclusive on **dates**.

### 3.1 Revenue (Umsatz) — **recognized / cash from billing**

| Field | Content |
|-------|---------|
| **Name** | Revenue (Umsatz) |
| **Definition** | Money **recognized from issued invoices** in the period, **not** from theoretical or listing rent unless no invoice exists (policy). |
| **Canonical formula** | \(\text{Revenue}_{\text{org},y,m} = \sum \texttt{invoices.amount}\) over all invoices where: `organization_id` matches, row is **included** per revenue policy (see §6), and the invoice is **attributed** to month \(y,m\) via the **attribution rule** below. |
| **Attribution rule (canonical)** | Prefer **`billing_year` = y AND `billing_month` = m** when both set; else attribute by **`issue_date`** falling in \([first\_day(y,m), last\_day(y,m)]\). |
| **Data source** | `invoices` (`amount`, `organization_id`, `billing_year`, `billing_month`, `issue_date`, `status`, …). |
| **Example** | March 2026: invoice A `amount=1200`, `billing_year=2026`, `billing_month=3` → counts 1200 for March. Invoice B `amount=800`, issue_date 2026-03-15, billing fields NULL → counts 800 for March if issue_date in March. |

**Important — implementation note:** Today’s backend services `revenue_forecast.calculate_monthly_revenue` and `profit_service.calculate_unit_profit` use **prorated `tenancies.rent_chf`**, not `invoices.amount`. That is **contractual / expected** revenue, not invoice-based. Dashboards and tests that must follow **this document** should use **invoice sums**; aligning code is a separate delivery step.

---

### 3.2 Costs (Kosten)

| Field | Content |
|-------|---------|
| **Name** | Costs (Kosten) |
| **Definition** | Total **monthly** operating costs allocated to units for the period. |
| **Formula (per unit u, month y,m)** | \(\text{Costs}_{u,y,m} = \sum_{c \in \text{unit\_costs for } u} c.\texttt{amount\_chf}\). **No** filter on `created_at` in the canonical definition unless product adds cost-effective dates. |
| **Org total** | \(\sum_{u \in \text{units in org}} \text{Costs}_{u,y,m}\). |
| **Fixed vs variable** | **Not** distinguished in the current schema. Conventionally: `cost_type` is a **label** only; **all** rows sum into “costs” unless a future migration adds `is_recurring` / `effective_from` / `effective_to`. |
| **Data source** | `unit_costs` (`unit_id`, `amount_chf`, `cost_type`). |
| **Example** | Unit X has rows: utilities 400, cleaning 150 → monthly costs = 550 for any month until rows change. |

---

### 3.3 Profit (Gewinn)

| Field | Content |
|-------|---------|
| **Name** | Profit (Gewinn) |
| **Definition** | Revenue minus costs for the same scope and period. |
| **Formula** | \(\text{Profit} = \text{Revenue} - \text{Costs}\) (same definitions as §3.1 and §3.2). |
| **Per unit** | \(\text{Profit}_{u,y,m} = \text{Revenue}_{u,y,m} - \text{Costs}_{u,y,m}\). |
| **Example** | Unit revenue 5000, costs 3200 → profit 1800. |

---

### 3.4 Occupancy rate (Auslastung)

| Field | Content |
|-------|---------|
| **Name** | Occupancy rate (snapshot) |
| **Definition** | Share of **active** rooms that are **occupied** on a given **calendar date** \(d\). |
| **Formula** | \(\text{occupancy\_rate}(d) = \dfrac{\text{occupied\_rooms}(d)}{\text{total\_rooms}} \times 100\%\), where `total_rooms` = count of `room` with `unit_id` in scope and `is_active` = true; **occupied** = room has a qualifying tenancy covering \(d\) (see §4). |
| **Data source** | `room`, `tenancies` (`status`, `move_in_date`, `move_out_date`). |
| **Example** | 8 active rooms, 6 occupied on 2026-03-31 → 75%. |

**Reserved vs occupied:** For snapshot rules matching current `occupancy_service`, **reserved** before move-in counts separately; “occupancy rate” in the strict sense is **occupied / total**. Dashboards may report **occupied + reserved** explicitly if needed.

---

### 3.5 Vacancy days (Leerstand)

| Field | Content |
|-------|---------|
| **Name** | Vacancy days |
| **Definition (strict, day-granular)** | For each **room** and each **day** in \([start, end]\), the room is **vacant** if no **active** tenancy covers that day. Sum **vacant room-days** over the scope. |
| **Approximation (current backend)** | `free_rooms` **on one snapshot date** (e.g. month-end) × `days_in_month` — **not** day-accurate; documented in `kpi_service` as estimated. |
| **Canonical formula** | \(\sum_{\text{room } r} \sum_{d=\text{start}}^{\text{end}} \mathbf{1}[\text{vacant}(r,d)]\). |
| **Data source** | `room`, `tenancies`. |
| **Example** | One room empty all 31 days of March → 31 vacant room-days for that room. |

---

### 3.6 Revenue per unit

| Field | Content |
|-------|---------|
| **Name** | Revenue per unit |
| **Definition** | Invoice-based revenue (§3.1) **allocated to a unit**, divided **optionally** by count of units or shown as total per unit row. |
| **Formula** | \(\text{Revenue}_{u,y,m}\) = sum of `invoices.amount` attributed to \(y,m\) with `invoices.unit_id = u` (or via tenancy→unit resolution if `unit_id` null — policy in §6). |
| **Example** | Unit A total 9600 CHF in Q1 as sum of March invoices → monthly slice per attribution. |

---

### 3.7 Profit per unit

| Field | Content |
|-------|---------|
| **Name** | Profit per unit |
| **Definition** | \(\text{Profit}_{u,y,m} = \text{Revenue}_{u,y,m} - \text{Costs}_{u,y,m}\) (§3.1–3.2). |
| **Example** | Revenue 5000, costs 3200 → 1800. |

---

### 3.8 Average rent per tenancy

| Field | Content |
|-------|---------|
| **Name** | Average rent per tenancy |
| **Definition** | Mean contractual monthly rent over tenancies **active** for at least one day in the period. |
| **Formula** | \(\text{AvgRent} = \dfrac{1}{|T|} \sum_{t \in T} t.\texttt{rent\_chf}\) where \(T\) = tenancies with `status` in {active, reserved} overlapping \([first, last]\) of month and `organization_id` in scope. |
| **Data source** | `tenancies.rent_chf` |
| **Example** | Two tenancies 800 and 1000 → average 900 CHF/month. |

This is **not** invoice average; it is **contract** rent.

---

### 3.9 Monthly profit trend

| Field | Content |
|-------|---------|
| **Name** | Monthly profit trend |
| **Definition** | Change in **profit** (§3.3) between two consecutive calendar months. |
| **Formula** | \(\Delta = \text{Profit}_{y,m} - \text{Profit}_{y',m'}\) where \((y',m')\) is the previous month; \(\%\) change = \(\Delta / \text{Profit}_{y',m'}\) when denominator ≠ 0. |
| **Data source** | Derived from invoice revenue and `unit_costs` per month. |
| **Example** | April profit 10k, March 8k → +2000, +25%. |

---

### 3.10 Break-even per unit

| Field | Content |
|-------|---------|
| **Name** | Break-even (per unit, per month) |
| **Definition** | Whether **revenue** for the unit covers **monthly unit costs** for that month. |
| **Formula (binary)** | **Above** if \(\text{Revenue}_{u,y,m} \ge \text{Costs}_{u,y,m}\); **below** if `<`; if \(\text{Costs}=0\), treat as **no costs** (revenue is “pure” profit for that line). |
| **Data source** | Same as §3.1 and §3.2. |
| **Example** | Costs 3000, revenue 3500 → above break-even. |

**Note:** This is **not** financial break-even including capex or taxes unless those are modeled as `unit_costs`.

---

## 4. Time Logic

### 4.1 Calendar month

- **First day:** `date(year, month, 1)`.
- **Last day:** from calendar (`monthrange`).
- **Days in month:** `(last - first).days + 1`.

### 4.2 Inclusive dates (tenancy occupancy on a day)

A tenancy **covers** date \(d\) iff:

- `move_in_date` ≤ \(d\) ≤ `move_out_date` if `move_out_date` is set;
- if `move_out_date` is **NULL** (open-ended), use \(d\) ≥ `move_in_date` only (upper bound +∞ in logic).

**Inclusive:** both move-in and move-out **days** count as occupied.

### 4.3 Half-open interval for **non-overlap** (DB constraint)

The database exclusion constraint uses a **half-open** `daterange` for overlap detection: \([move\_in, move\_out+1)\) so adjacent tenancies on the same **unit** do not count as overlapping. **KPI occupancy** still treats calendar days inclusively as above.

### 4.4 Partial month — **tenancy-based proration** (current code path)

When computing **expected** monthly revenue from `rent_chf` (`revenue_forecast`):

- Overlap with \([first, last]\): `start = max(first, move_in_date)`, `end = min(last, move_out_or_far_future)`.
- **Occupied days in month:** `(end - start).days + 1`.
- **Prorated revenue:** `rent_chf * (occupied_days / days_in_month)` for the **first matching** tenancy per room in implementation order.

This does **not** apply to **invoice-based** revenue (§3.1), where attribution is by billing month / issue date unless product defines daily recognition.

### 4.5 Overlapping tenancies

- **Same unit:** prevented by DB exclusion constraint for date ranges.
- **Same room:** should be impossible in valid data; if duplicated, implementation picks first match in iteration order — **invalid state**.

---

## 5. Edge Cases

| Situation | Behavior |
|-----------|------------|
| **Open-ended tenancy** (`move_out_date` NULL) | Treated as occupied from `move_in_date` forward for snapshots; proration uses a far-future cap in code for month windows. |
| **Overlapping tenancies** | Invalid for same **unit** dates per DB; do not rely on KPIs until fixed. |
| **Missing invoices** | Revenue (invoice-based) = 0 for that billable event; contractual rent may still exist on tenancy — do not mix without labeling. |
| **Invoice `unit_id` NULL** | Revenue still counts for **org** total; unit-level revenue needs allocation rule (e.g. via `tenancy_id` → `tenancies.unit_id`) — **must be specified in product** (§6). |
| **Unit without costs** | `Costs` = 0; profit = revenue. |
| **Unit without tenants** | Occupancy 0; invoice revenue may still exist if mislinked — data quality issue. |
| **Future tenancy** (`move_in` > today) | Snapshot: not occupied until `move_in_date`; reserved semantics per `status`. |
| **Cancelled invoices** | Excluded from revenue if policy says so (§6). |
| **Ended tenancy** | Included only for days/status where `move_out_date` and `status` still qualify for the query. |

---

## 6. Assumptions

1. **Multi-tenancy:** All KPIs are computed **within** one `organization_id` unless comparing orgs explicitly.
2. **Invoice revenue (canonical for “Umsatz” reporting):** Sum of `invoices.amount` per §3.1 attribution; **status filter** must be fixed (e.g. exclude `cancelled`; include `paid` and `open` or only `paid` — **product decision**, default for **recognized revenue:** exclude `cancelled`; include amounts when `status` ∈ {`paid`, `open`, `overdue`, `unpaid`} unless finance requires only `paid`).
3. **Tenancy revenue (operational forecast):** `rent_chf` proration is **not** a substitute for invoice revenue in accounting sense; label as “expected / contractual” when shown.
4. **Costs:** Every `unit_costs` row counts as **one monthly CHF amount** in rolling sum; no amortization.
5. **Rooms:** Only `room.is_active = true` participates in room counts for occupancy.
6. **Currency:** Single-currency CHF in model defaults; multi-currency not modeled — if `currency` ≠ CHF, conversion is **out of scope** until implemented.
7. **RLS:** Queries run under org context; KPIs assume **complete** visibility of org rows.
8. **Vacancy KPI:** Prefer **day-level** vacancy (§3.5 canonical) when implementing new features; current API may expose **estimated** room-days.

---

*Document version: aligned with `db/models.py` Tenancy, Invoice, UnitCost, Unit, Room and backend services `occupancy_service`, `revenue_forecast`, `profit_service`, `kpi_service` as of authoring. Canonical invoice-based revenue supersedes tenancy-based sums for **financial** KPIs where this document and product policy agree.*
