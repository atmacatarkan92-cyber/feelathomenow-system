/**
 * Deterministic audit severity for platform / admin UI (display-only, no API field).
 */

/**
 * @param {{ action?: string, target_type?: string, entity_type?: string }} log
 * @returns {"info"|"medium"|"high"|"critical"}
 */
export function getAuditSeverity(log) {
  return getAuditSeverityDetail(log).level;
}

/**
 * @param {{ action?: string, target_type?: string, entity_type?: string }} log
 * @returns {{ level: "info"|"medium"|"high"|"critical", label: string }}
 */
export function getAuditSeverityDetail(log) {
  const level = resolveAuditSeverityLevel(log);
  return { level, label: auditSeverityLabelDe(level) };
}

function resolveAuditSeverityLevel(log) {
  if (!log) return "info";
  const a = String(log.action || "").toLowerCase();
  if (a === "impersonation_started") return "critical";
  if (a === "delete") return "high";
  if (a === "create" || a === "update") return "medium";
  if (a === "login" || a === "logout") return "info";
  return "info";
}

export function auditSeverityLabelDe(severity) {
  switch (severity) {
    case "critical":
      return "Kritisch";
    case "high":
      return "Hoch";
    case "medium":
      return "Mittel";
    case "info":
    default:
      return "Info";
  }
}

/** Tailwind classes: subtle pill, works in light + dark (platform audit). */
export function auditSeverityPillClass(severity) {
  switch (severity) {
    case "critical":
      return "border-rose-400/80 bg-rose-100 text-rose-900 dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-200";
    case "high":
      return "border-amber-400/80 bg-amber-100 text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/15 dark:text-amber-200";
    case "medium":
      return "border-sky-400/70 bg-sky-100 text-sky-900 dark:border-sky-400/35 dark:bg-sky-500/15 dark:text-sky-200";
    case "info":
    default:
      return "border-slate-300 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/[0.08] dark:text-slate-300";
  }
}
