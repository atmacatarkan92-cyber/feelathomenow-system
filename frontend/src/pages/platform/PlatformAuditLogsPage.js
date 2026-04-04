import React, { useEffect, useState } from "react";
import { fetchPlatformAuditLogs } from "../../api/adminData";

function formatMeta(meta) {
  if (meta == null || typeof meta !== "object") return "—";
  try {
    return JSON.stringify(meta);
  } catch {
    return "—";
  }
}

/**
 * Platform admin: last 50 audit log rows (cross-tenant).
 */
function PlatformAuditLogsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchPlatformAuditLogs()
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Laden fehlgeschlagen.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl bg-[#f8fafc] px-4 py-6 text-[#0f172a] [color-scheme:light] dark:bg-[#07090f] dark:text-[#eef2ff] dark:[color-scheme:dark]">
      <div className="mb-6">
        <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#fb923c]">
          Vantio Platform
        </div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">Audit-Protokoll</h1>
        <p className="mt-2 text-[13px] text-[#64748b] dark:text-[#6b7a9a]">
          Letzte 50 Einträge (plattformweit).
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-[10px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-[14px] text-[#f87171]">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-[13px] text-[#64748b] dark:text-[#6b7a9a]">Lade …</p>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border border-black/10 bg-white dark:border-white/[0.07] dark:bg-[#141824]">
          <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/[0.08]">
                <th className="px-3 py-2.5 font-semibold text-[#64748b] dark:text-[#94a3b8]">
                  Zeit
                </th>
                <th className="px-3 py-2.5 font-semibold text-[#64748b] dark:text-[#94a3b8]">
                  Akteur
                </th>
                <th className="px-3 py-2.5 font-semibold text-[#64748b] dark:text-[#94a3b8]">
                  Aktion
                </th>
                <th className="px-3 py-2.5 font-semibold text-[#64748b] dark:text-[#94a3b8]">
                  Organisation
                </th>
                <th className="px-3 py-2.5 font-semibold text-[#64748b] dark:text-[#94a3b8]">
                  Metadaten
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[#64748b] dark:text-[#6b7a9a]">
                    Keine Einträge.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-black/[0.06] dark:border-white/[0.05]"
                  >
                    <td className="whitespace-nowrap px-3 py-2 align-top text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="max-w-[180px] px-3 py-2 align-top break-all">
                      {r.actor_email || r.actor_user_id || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top font-medium">{r.action}</td>
                    <td className="max-w-[200px] px-3 py-2 align-top break-all">
                      {r.organization_name || r.organization_id || "—"}
                    </td>
                    <td className="max-w-[240px] px-3 py-2 align-top text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                      {formatMeta(r.metadata)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PlatformAuditLogsPage;
