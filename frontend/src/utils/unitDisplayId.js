/**
 * Short unit labels for admin UI (APT-001 / CL-001).
 * API calls and routing still use UUID (`unit.id` / `unit.unitId`).
 */

export function normalizeUnitTypeLabel(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const hyphenNorm = t
    .replace(/\u2011/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2010/g, "-")
    .replace(/\u2012/g, "-")
    .replace(/\u2212/g, "-");
  const compact = hyphenNorm.replace(/\s+/g, "");
  if (/^co[-]?living$/i.test(compact) || /^coliving$/i.test(compact)) return "Co-Living";
  return hyphenNorm;
}

export function getDisplayUnitId(unit, index) {
  if (!unit) return "—";
  const prefix = normalizeUnitTypeLabel(unit.type) === "Co-Living" ? "CL" : "APT";
  return `${prefix}-${String(index + 1).padStart(3, "0")}`;
}
