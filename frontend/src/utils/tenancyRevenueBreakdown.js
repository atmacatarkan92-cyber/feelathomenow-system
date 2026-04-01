/**
 * TenancyRevenue: monthly equivalent and per-type breakdown (shared admin UI).
 * Aligns with backend proration concepts; KPI month totals may still differ slightly.
 */

/** Stable API/storage values with German labels in UI */
export const REVENUE_TYPE_OPTIONS = [
  { value: "rent", label: "Miete" },
  { value: "service_fee", label: "Servicegebühr" },
  { value: "utilities", label: "Nebenkosten" },
  { value: "furniture", label: "Möbelbenutzung" },
  { value: "cleaning", label: "Reinigung" },
  { value: "setup_fee", label: "Setup Fee" },
  { value: "other", label: "Sonstiges" },
];

export const REVENUE_TYPE_VALUE_SET = new Set(REVENUE_TYPE_OPTIONS.map((o) => o.value));

/**
 * Stable UI order: standard types, then legacy/custom keys (de), then empty type.
 * Matches product order: Miete → Nebenkosten → … → Sonstiges → unknown → —.
 */
const BREAKDOWN_TYPE_ORDER = [
  "rent",
  "utilities",
  "service_fee",
  "furniture",
  "cleaning",
  "setup_fee",
  "other",
];

function compareBreakdownEntriesStable(a, b) {
  const rank = (typeKey) => {
    const k = typeKey === "__empty__" ? "__empty__" : String(typeKey).trim();
    if (k === "__empty__") return [2, ""];
    const idx = BREAKDOWN_TYPE_ORDER.indexOf(k);
    if (idx >= 0) return [0, String(idx).padStart(2, "0")];
    return [1, k.toLowerCase()];
  };
  const [ta, ka] = rank(a.typeKey);
  const [tb, kb] = rank(b.typeKey);
  if (ta !== tb) return ta - tb;
  return ka.localeCompare(kb, "de");
}

function sortBreakdownEntriesStable(entries) {
  if (!Array.isArray(entries)) return [];
  return [...entries].sort(compareBreakdownEntriesStable);
}

export function normalizeRevenueFrequency(raw) {
  const k = String(raw || "monthly").trim().toLowerCase() || "monthly";
  if (!["monthly", "yearly", "one_time"].includes(k)) return "monthly";
  return k;
}

export function revenueFrequencyLabel(freq) {
  const k = String(freq || "monthly").trim().toLowerCase();
  if (k === "yearly") return "Jährlich";
  if (k === "one_time") return "Einmalig";
  return "Monatlich";
}

export function revenueTypeLabelForDisplay(raw) {
  const v = String(raw || "").trim();
  if (!v) return "—";
  const hit = REVENUE_TYPE_OPTIONS.find((o) => o.value === v);
  return hit ? hit.label : v;
}

export function monthlyEquivalentFromRevenueRows(rows) {
  if (!Array.isArray(rows)) return 0;
  let sum = 0;
  for (const r of rows) {
    const f = normalizeRevenueFrequency(r?.frequency);
    if (f === "one_time") continue;
    const amt = Number(r?.amount_chf);
    if (!Number.isFinite(amt)) continue;
    sum += f === "yearly" ? amt / 12 : amt;
  }
  return sum;
}

export function totalOneTimeRevenueFromRows(rows) {
  if (!Array.isArray(rows)) return 0;
  let sum = 0;
  for (const r of rows) {
    if (normalizeRevenueFrequency(r?.frequency) !== "one_time") continue;
    const amt = Number(r?.amount_chf);
    if (!Number.isFinite(amt)) continue;
    sum += amt;
  }
  return sum;
}

/** Recurring rows only: summed monthly-equivalent per stored type key */
export function recurringMonthlyBreakdownEntries(rows) {
  if (!Array.isArray(rows)) return [];
  const map = new Map();
  for (const r of rows) {
    const f = normalizeRevenueFrequency(r?.frequency);
    if (f === "one_time") continue;
    const amt = Number(r?.amount_chf);
    if (!Number.isFinite(amt)) continue;
    const monthly = f === "yearly" ? amt / 12 : amt;
    const typeKey = String(r?.type || "").trim();
    const k = typeKey || "__empty__";
    map.set(k, (map.get(k) || 0) + monthly);
  }
  const out = Array.from(map.entries())
    .map(([typeKey, total]) => ({
      typeKey,
      label: typeKey === "__empty__" ? "—" : revenueTypeLabelForDisplay(typeKey),
      total,
    }))
    .filter((x) => x.total !== 0);
  return sortBreakdownEntriesStable(out);
}

export function oneTimeBreakdownEntries(rows) {
  if (!Array.isArray(rows)) return [];
  const map = new Map();
  for (const r of rows) {
    if (normalizeRevenueFrequency(r?.frequency) !== "one_time") continue;
    const amt = Number(r?.amount_chf);
    if (!Number.isFinite(amt)) continue;
    const typeKey = String(r?.type || "").trim();
    const k = typeKey || "__empty__";
    map.set(k, (map.get(k) || 0) + amt);
  }
  const out = Array.from(map.entries())
    .map(([typeKey, total]) => ({
      typeKey,
      label: typeKey === "__empty__" ? "—" : revenueTypeLabelForDisplay(typeKey),
      total,
    }))
    .filter((x) => x.total !== 0);
  return sortBreakdownEntriesStable(out);
}

function mergeBreakdownEntries(entriesList) {
  const map = new Map();
  for (const entries of entriesList) {
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const k = e.typeKey;
      map.set(k, (map.get(k) || 0) + (Number(e.total) || 0));
    }
  }
  const out = Array.from(map.entries())
    .map(([typeKey, total]) => ({
      typeKey,
      label: typeKey === "__empty__" ? "—" : revenueTypeLabelForDisplay(typeKey),
      total,
    }))
    .filter((x) => x.total !== 0);
  return sortBreakdownEntriesStable(out);
}

/** Sum recurring monthly-equivalent breakdown across many tenancy row lists */
export function aggregateRecurringMonthlyBreakdownRows(rowArrays) {
  if (!Array.isArray(rowArrays) || rowArrays.length === 0) return [];
  const perTenancy = rowArrays.map((rows) => recurringMonthlyBreakdownEntries(rows));
  return mergeBreakdownEntries(perTenancy);
}

export function aggregateOneTimeBreakdownRows(rowArrays) {
  if (!Array.isArray(rowArrays) || rowArrays.length === 0) return [];
  const perTenancy = rowArrays.map((rows) => oneTimeBreakdownEntries(rows));
  return mergeBreakdownEntries(perTenancy);
}

export function aggregateMonthlyEquivalentFromRowArrays(rowArrays) {
  if (!Array.isArray(rowArrays)) return 0;
  let sum = 0;
  for (const rows of rowArrays) {
    sum += monthlyEquivalentFromRevenueRows(rows);
  }
  return sum;
}

export function aggregateOneTimeTotalFromRowArrays(rowArrays) {
  if (!Array.isArray(rowArrays)) return 0;
  let sum = 0;
  for (const rows of rowArrays) {
    sum += totalOneTimeRevenueFromRows(rows);
  }
  return sum;
}
