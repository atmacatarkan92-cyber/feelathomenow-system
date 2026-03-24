/**
 * Display label for CRM lists and headers.
 * Order: 1) API display_name 2) first_name + last_name 3) legacy name only.
 * (full_name is redundant with display_name from API; not used here.)
 */
export function tenantDisplayName(t) {
  if (!t) return "";
  const d = String(t.display_name || "").trim();
  if (d) return d;
  const fn = (t.first_name || "").trim();
  const ln = (t.last_name || "").trim();
  if (fn || ln) return `${fn} ${ln}`.trim();
  return String(t.name || "").trim() || "";
}
