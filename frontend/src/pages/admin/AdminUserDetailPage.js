import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { resendVerificationEmail } from "../../api/auth";
import { fetchAdminUser } from "../../api/adminData";

const cardClass =
  "rounded-[14px] border border-black/10 dark:border-white/[0.07] bg-white dark:bg-[#141824] p-6";

function formatDateTime(iso) {
  if (iso == null || iso === "") return "—";
  const normalized = typeof iso === "string" && !/Z|[+-]\d{2}:?\d{2}$/.test(iso) ? `${iso}Z` : iso;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminUserDetailPage() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    setError("");
    fetchAdminUser(userId)
      .then((data) => {
        setUser(data);
        if (!data) setError("Benutzer nicht gefunden.");
      })
      .catch((e) => setError(e.message || "Fehler beim Laden."))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleResend = (e) => {
    e.preventDefault();
    if (!user?.email || resending) return;
    setResending(true);
    resendVerificationEmail(user.email)
      .then(() => toast.success("Bestätigungsmail erneut gesendet"))
      .catch((err) => toast.error(err?.message || "Anfrage fehlgeschlagen."))
      .finally(() => setResending(false));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] px-2 text-[#0f172a] [color-scheme:light] dark:bg-[#07090f] dark:text-[#eef2ff] dark:[color-scheme:dark]">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          to="/admin/users"
          className="text-[13px] font-semibold text-[#64748b] no-underline hover:underline dark:text-[#8090b0]"
        >
          ← Zurück zur Liste
        </Link>
      </div>

      <h2 className="mb-4 text-[22px] font-bold">Benutzer</h2>

      {loading && <p className="text-[14px] text-[#64748b] dark:text-[#6b7a9a]">Wird geladen …</p>}
      {error && !loading && <p className="mb-3 text-[14px] text-[#f87171]">{error}</p>}

      {!loading && user && (
        <div className={cardClass}>
          <dl className="grid gap-4 text-[13px]">
            <div>
              <dt className="mb-1 text-[10px] font-medium text-[#64748b] dark:text-[#6b7a9a]">Name</dt>
              <dd className="font-medium text-[#0f172a] dark:text-[#eef2ff]">{user.full_name || "—"}</dd>
            </div>
            <div>
              <dt className="mb-1 text-[10px] font-medium text-[#64748b] dark:text-[#6b7a9a]">E-Mail</dt>
              <dd className="font-medium text-[#0f172a] dark:text-[#eef2ff]">{user.email || "—"}</dd>
            </div>
            <div>
              <dt className="mb-1 text-[10px] font-medium text-[#64748b] dark:text-[#6b7a9a]">Rolle</dt>
              <dd className="font-medium text-[#0f172a] dark:text-[#eef2ff]">{user.role || "—"}</dd>
            </div>
            <div>
              <dt className="mb-1 text-[10px] font-medium text-[#64748b] dark:text-[#6b7a9a]">Status</dt>
              <dd>
                {user.is_active ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                    Aktiv
                  </span>
                ) : (
                  <span className="text-[13px] text-[#64748b] dark:text-[#6b7a9a]">Inaktiv</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-[10px] font-medium text-[#64748b] dark:text-[#6b7a9a]">
                E-Mail Verifikation
              </dt>
              <dd className="space-y-3">
                {user.email_verified_at ? (
                  <div>
                    <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                      Verifiziert
                    </span>
                    <span className="ml-2 text-[13px] text-[#64748b] dark:text-[#6b7a9a]">
                      {formatDateTime(user.email_verified_at)}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-amber-200">
                      Nicht verifiziert
                    </span>
                    <button
                      type="button"
                      disabled={resending}
                      onClick={handleResend}
                      className="w-fit rounded-[8px] border border-black/10 bg-transparent px-3 py-1.5 text-[12px] font-semibold text-[#64748b] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.1] dark:text-[#8090b0] dark:hover:bg-white/[0.04]"
                    >
                      {resending ? "Wird gesendet…" : "Bestätigungsmail senden"}
                    </button>
                  </div>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
