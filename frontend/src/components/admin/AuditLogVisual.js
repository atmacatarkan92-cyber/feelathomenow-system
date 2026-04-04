import React from "react";
import {
  auditActionLabel,
  auditActorDisplay,
  formatAuditTimestamp,
} from "../../utils/auditDisplay";

/** @typedef {{ label: string, old: string, new: string }} AuditChange */

const metaMuted =
  "text-[11px] text-slate-600 dark:text-[#6b7a9a] leading-snug";

const summaryText =
  "text-sm font-semibold text-[#0f172a] dark:text-[#eef2ff] leading-snug";

function displayCell(v) {
  if (v == null || v === "") return "—";
  return String(v);
}

function isNarrativeOnlyChange(c) {
  const o = displayCell(c.old);
  return (c.label === "Ereignis" || c.label === "Details") && (o === "—" || o === "");
}

/**
 * Structured old/new rows for audit field diffs (presentation only).
 * @param {{ changes: AuditChange[], className?: string, listClassName?: string }} props
 */
export function AuditChangeRows({ changes, className = "", listClassName = "" }) {
  if (!changes || changes.length === 0) return null;
  return (
    <ul className={`space-y-2 ${listClassName || "mt-2"}`}>
      {changes.map((c, idx) => {
        if (isNarrativeOnlyChange(c)) {
          return (
            <li
              key={idx}
              className="rounded-lg border border-black/[0.06] bg-slate-50/80 px-2.5 py-2 text-[12px] text-[#0f172a] dark:border-white/[0.08] dark:bg-[#0c1018]/80 dark:text-[#e2e8f0]"
            >
              {displayCell(c.new)}
            </li>
          );
        }
        return (
          <li
            key={idx}
            className={`rounded-lg border border-black/[0.06] bg-white px-2.5 py-2 dark:border-white/[0.08] dark:bg-[#111520]/90 ${className}`}
          >
            <div className="text-[11px] font-medium text-slate-700 dark:text-[#94a3b8]">{c.label}</div>
            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#64748b]">
                  Alt
                </div>
                <div className="mt-0.5 break-words rounded-md border border-amber-200/80 bg-amber-50/90 px-2 py-1.5 text-[12px] text-amber-950 tabular-nums dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
                  {displayCell(c.old)}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#64748b]">
                  Neu
                </div>
                <div className="mt-0.5 break-words rounded-md border border-emerald-200/80 bg-emerald-50/90 px-2 py-1.5 text-[12px] text-emerald-950 tabular-nums dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100">
                  {displayCell(c.new)}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One audit entry for admin entity timelines (summary → changes → meta).
 * @param {object} props
 * @param {string} props.summary
 * @param {AuditChange[]} [props.changes]
 * @param {string} [props.createdAt]
 * @param {string|null} [props.actor]
 * @param {string} [props.action] — raw action; shown via auditActionLabel in meta when showActionBadge is true
 * @param {boolean} [props.showActionInMeta]
 * @param {string} [props.dotClassName]
 * @param {string} [props.metaClassName]
 */
export function AdminAuditTimelineEntry({
  summary,
  changes = [],
  createdAt,
  actor,
  action,
  showActionInMeta = true,
  dotClassName = "bg-[#fb923c]",
  metaClassName,
}) {
  const act = actor != null ? actor : null;
  const metaCls = metaClassName || metaMuted;
  const parts = [];
  if (createdAt) parts.push(formatAuditTimestamp(createdAt));
  if (showActionInMeta && action != null && String(action) !== "") {
    parts.push(auditActionLabel(action));
  }
  if (act) parts.push(act);
  const metaLine = parts.join(" · ");

  return (
    <li className="relative pb-4 last:pb-0 pl-2 -ml-px border-l border-transparent">
      <span
        className={`absolute -left-[5px] top-1.5 h-2 w-2 rounded-full ${dotClassName}`}
        aria-hidden
      />
      <p className={summaryText}>
        {summary}
      </p>
      <AuditChangeRows changes={changes} />
      {metaLine ? <p className={`mt-2 ${metaCls}`}>{metaLine}</p> : null}
    </li>
  );
}

/**
 * Timeline wrapper matching AdminUnitDetailPage structure (border-l + spacing).
 */
export function AdminAuditTimeline({ children, className = "" }) {
  return (
    <ul
      className={`ml-1 space-y-0 border-l-2 border-black/10 pl-4 dark:border-white/[0.08] ${className}`}
    >
      {children}
    </ul>
  );
}

export { auditActorDisplay, formatAuditTimestamp, auditActionLabel };
