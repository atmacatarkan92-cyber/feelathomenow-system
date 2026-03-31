/**
 * Resolve a foreign-key id to a human-readable label for audit history display.
 * Falls back to the raw string id when no label is known.
 */
export function resolveAuditFkDisplay(value, idToLabel) {
  if (value == null || value === "") return "—";
  const s = String(value);
  const map = idToLabel || {};
  return map[s] || s;
}
