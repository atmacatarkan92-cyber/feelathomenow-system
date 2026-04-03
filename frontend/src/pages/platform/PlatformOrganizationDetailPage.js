import React, { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchPlatformOrganization } from "../../api/adminData";

function formatCreatedAt(raw) {
  if (raw == null || raw === "") return "—";
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function isOrgAdminRole(role) {
  if (role == null) return false;
  return String(role).toLowerCase() === "admin";
}

function PlatformOrganizationDetailPage() {
  const { organizationId } = useParams();
  const { user, loading: authLoading, isPlatformAdminAuthenticated } = useAuth();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      setError("Organisation nicht gefunden.");
      return;
    }
    setLoading(true);
    setError("");
    fetchPlatformOrganization(organizationId)
      .then((data) => setOrg(data))
      .catch((e) => {
        setError(e.message || "Fehler beim Laden.");
        setOrg(null);
      })
      .finally(() => setLoading(false));
  }, [organizationId]);

  if (authLoading) {
    return (
      <div className="min-h-[40vh] bg-[#f8fafc] px-4 py-8 text-[#64748b] [color-scheme:light] dark:bg-[#07090f] dark:text-[#6b7a9a] dark:[color-scheme:dark]">
        Lade …
      </div>
    );
  }

  if (!user || !isPlatformAdminAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-[40vh] bg-[#f8fafc] px-4 py-8 text-[#64748b] [color-scheme:light] dark:bg-[#07090f] dark:text-[#6b7a9a] dark:[color-scheme:dark]">
        Lade Organisation …
      </div>
    );
  }

  const name = org?.name || "—";
  const usersList = Array.isArray(org?.users) ? org.users : null;

  return (
    <div className="grid min-h-screen gap-6 bg-[#f8fafc] px-4 py-6 text-[#0f172a] [color-scheme:light] dark:bg-[#07090f] dark:text-[#eef2ff] dark:[color-scheme:dark]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="mb-2 text-[12px] text-[#64748b] dark:text-[#6b7a9a]">
            <Link
              to="/platform/organizations"
              className="font-semibold text-[#5b8cff] no-underline hover:underline"
            >
              Organisationen
            </Link>
            <span className="mx-1.5 text-[#94a3b8]">/</span>
            <span className="text-[#0f172a] dark:text-[#eef2ff]">{name}</span>
          </nav>
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#fb923c]">
            Vantio Platform
          </div>
          <h1 className="text-[22px] font-bold">{name}</h1>
          <p className="mt-2 text-[12px] text-[#64748b] dark:text-[#6b7a9a]">
            Plattform-Ansicht dieser Organisation
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/platform/organizations"
            className="inline-flex h-[40px] cursor-pointer items-center justify-center rounded-[8px] border border-black/10 bg-white px-4 text-[13px] font-semibold text-[#0f172a] no-underline hover:bg-black/[0.03] dark:border-white/[0.1] dark:bg-[#141824] dark:text-[#eef2ff] dark:hover:bg-white/[0.04]"
          >
            Zurück zu Organisationen
          </Link>
          <button
            type="button"
            disabled
            title="Bald verfügbar"
            className="inline-flex h-[40px] cursor-not-allowed items-center justify-center rounded-[8px] border border-black/10 bg-slate-100 px-4 text-[13px] font-semibold text-[#94a3b8] opacity-70 dark:border-white/[0.08] dark:bg-[#111520] dark:text-[#627588]"
          >
            Organisation öffnen
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[10px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-[14px] text-[#f87171]">
          {error}
        </div>
      )}

      {org && !error ? (
        <>
          <div className="rounded-[14px] border border-black/10 bg-white p-5 dark:border-white/[0.07] dark:bg-[#141824]">
            <h2 className="mb-4 text-[16px] font-bold text-[#0f172a] dark:text-[#eef2ff]">Metadaten</h2>
            <dl className="grid gap-3 text-[14px] sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-[#64748b] dark:text-[#6b7a9a]">
                  ID
                </dt>
                <dd className="mt-1 font-mono text-[13px] text-[#0f172a] dark:text-[#eef2ff]">{org.id}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-[#64748b] dark:text-[#6b7a9a]">
                  Slug
                </dt>
                <dd className="mt-1 text-[#0f172a] dark:text-[#eef2ff]">
                  {org.slug != null && org.slug !== "" ? org.slug : "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-[#64748b] dark:text-[#6b7a9a]">
                  Erstellt
                </dt>
                <dd className="mt-1 text-[#0f172a] dark:text-[#eef2ff]">{formatCreatedAt(org.created_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="overflow-x-auto rounded-[14px] border border-black/10 bg-white p-5 dark:border-white/[0.07] dark:bg-[#141824]">
            <h2 className="mb-4 text-[16px] font-bold text-[#0f172a] dark:text-[#eef2ff]">Benutzer</h2>
            {usersList && usersList.length > 0 ? (
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-black/10 bg-slate-100 text-left text-[9px] font-bold uppercase tracking-[0.8px] text-[#64748b] dark:border-white/[0.05] dark:bg-[#111520] dark:text-[#6b7a9a]">
                    <th className="px-3 py-3">Name / E-Mail</th>
                    <th className="px-3 py-3">Rolle</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Erstellt</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => {
                    const label = [u.full_name, u.email].filter(Boolean).join(" · ") || u.email || "—";
                    const admin = isOrgAdminRole(u.role);
                    return (
                      <tr
                        key={u.id || u.email}
                        className="border-b border-black/5 dark:border-white/[0.04]"
                      >
                        <td className="px-3 py-3 font-medium text-[#0f172a] dark:text-[#eef2ff]">
                          {label}
                          {admin ? (
                            <span className="ml-2 inline-flex rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200">
                              Admin
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-[#64748b] dark:text-[#94a3b8]">{u.role ?? "—"}</td>
                        <td className="px-3 py-3 text-[#64748b] dark:text-[#94a3b8]">
                          {u.is_active === false ? "Inaktiv" : "Aktiv"}
                        </td>
                        <td className="px-3 py-3 text-[#64748b] dark:text-[#94a3b8]">
                          {formatCreatedAt(u.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-[13px] text-[#64748b] dark:text-[#6b7a9a]">
                User-Daten werden später ergänzt
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default PlatformOrganizationDetailPage;
