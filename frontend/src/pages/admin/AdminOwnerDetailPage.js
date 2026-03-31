import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchAdminOwner,
  fetchAdminOwnerUnits,
  normalizeUnit,
  patchAdminOwner,
} from "../../api/adminData";
import { normalizeUnitTypeLabel } from "../../utils/unitDisplayId";

function formatChfMonthly(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `CHF ${n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function unitTypeBadgeClasses(type) {
  const raw = String(type ?? "").trim();
  const normalized = normalizeUnitTypeLabel(raw);
  if (normalized === "Co-Living") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }
  if (raw === "Business Apartment") {
    return "border-violet-200 bg-violet-50 text-violet-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function unitStatusBadgeClasses(status) {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "frei" || s === "") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (s === "belegt" || s === "occupied") return "border-blue-200 bg-blue-50 text-blue-800";
  if (s === "reserviert" || s === "reserved") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const normalized = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminOwnerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsError, setUnitsError] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    status: "active",
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    fetchAdminOwner(id)
      .then((row) => {
        if (!row) {
          setError("Eigentümer nicht gefunden.");
          setOwner(null);
          return;
        }
        setOwner(row);
      })
      .catch(() => {
        setError("Eigentümer konnte nicht geladen werden.");
        setOwner(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setUnitsLoading(true);
    setUnitsError(null);
    fetchAdminOwnerUnits(id)
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setUnits(arr.map((u) => normalizeUnit(u)));
      })
      .catch((e) => {
        setUnits([]);
        setUnitsError(e?.message?.trim() || "Units konnten nicht geladen werden.");
      })
      .finally(() => setUnitsLoading(false));
  }, [id]);

  const openEdit = () => {
    if (!owner) return;
    setEditErr(null);
    setEditForm({
      name: owner.name || "",
      email: owner.email || "",
      phone: owner.phone || "",
      status: String(owner.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
    });
    setEditOpen(true);
  };

  const submitEdit = (e) => {
    e.preventDefault();
    if (!id) return;
    setEditSaving(true);
    setEditErr(null);
    patchAdminOwner(id, {
      name: editForm.name.trim(),
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
      status: editForm.status === "inactive" ? "inactive" : "active",
    })
      .then((row) => {
        setOwner(row);
        setEditOpen(false);
      })
      .catch((err) => setEditErr(err?.message || "Speichern fehlgeschlagen."))
      .finally(() => setEditSaving(false));
  };

  if (loading) {
    return <p className="px-2 text-slate-500">Lade Eigentümer …</p>;
  }

  if (error || !owner) {
    return (
      <div className="px-2 max-w-3xl">
        <p className="text-red-700 mb-3">{error || "Nicht gefunden."}</p>
        <button
          type="button"
          onClick={() => navigate("/admin/owners")}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800"
        >
          Zurück zur Liste
        </button>
      </div>
    );
  }

  const displayName = String(owner.name || "").trim() || "Eigentümer";
  const isOwnerActive = String(owner.status || "active").toLowerCase() !== "inactive";

  const handleToggleStatus = () => {
    if (!id) return;
    const next = isOwnerActive ? "inactive" : "active";
    const msg =
      next === "inactive"
        ? "Diesen Eigentümer wirklich als inaktiv markieren?"
        : "Diesen Eigentümer wieder aktivieren?";
    if (!window.confirm(msg)) return;
    setStatusSaving(true);
    patchAdminOwner(id, { status: next })
      .then((row) => setOwner(row))
      .catch((e) => {
        window.alert(e?.message || "Status konnte nicht geändert werden.");
      })
      .finally(() => setStatusSaving(false));
  };

  return (
    <div className="px-2 max-w-3xl">
      <p className="mb-4">
        <Link
          to="/admin/owners"
          className="text-sm font-semibold text-slate-900 hover:underline"
        >
          ← Eigentümer
        </Link>
      </p>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 gap-y-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{displayName}</h1>
            <span
              className={
                isOwnerActive
                  ? "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
                  : "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600"
              }
            >
              {isOwnerActive ? "Aktiv" : "Inaktiv"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Eigentümer / Owner</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openEdit}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Bearbeiten
          </button>
          <button
            type="button"
            disabled={statusSaving}
            onClick={handleToggleStatus}
            className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {statusSaving
              ? "…"
              : isOwnerActive
                ? "Als inaktiv markieren"
                : "Aktivieren"}
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 shadow-sm bg-white p-5 md:p-6 mb-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Stammdaten</h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Name</p>
            <p className="text-sm font-medium text-slate-900 mt-1">{displayName}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">E-Mail</p>
            <p className="text-sm font-medium text-slate-900 mt-1">{owner.email?.trim() || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Telefonnummer</p>
            <p className="text-sm font-medium text-slate-900 mt-1">{owner.phone?.trim() || "—"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 shadow-sm bg-white p-5 md:p-6 mb-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Zugeordnete Units</h2>
        {unitsLoading ? (
          <div className="space-y-2" aria-busy="true">
            <p className="text-sm text-slate-500">Lade Units …</p>
            <div className="h-2 w-full max-w-xs rounded bg-slate-100 animate-pulse" />
            <div className="h-2 w-full max-w-[14rem] rounded bg-slate-100 animate-pulse" />
          </div>
        ) : unitsError ? (
          <p className="text-sm text-red-700">{unitsError}</p>
        ) : units.length === 0 ? (
          <p className="text-sm text-slate-600">Keine Units zugeordnet</p>
        ) : (
          <ul className="space-y-3">
            {units.map((u) => {
              const uid = u.unitId ?? u.id;
              const title = (u.title || u.name || "").trim() || "—";
              const typeLabel = normalizeUnitTypeLabel(u.type) || String(u.type || "").trim() || "—";
              const addr = String(u.address || "").trim();
              const zip = String(u.zip ?? "").trim();
              const city = String(u.city || "").trim();
              const zipCity = [zip, city].filter(Boolean).join(" ");
              const propTitle = String(u.property_title || "").trim();
              return (
                <li
                  key={String(uid)}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/admin/units/${encodeURIComponent(uid)}`}
                        className="text-base font-semibold text-slate-900 hover:text-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 rounded-sm"
                      >
                        {title}
                      </Link>
                      {propTitle ? (
                        <p className="text-xs text-slate-500 mt-1">Liegenschaft: {propTitle}</p>
                      ) : null}
                      {addr ? <p className="text-sm text-slate-600 mt-2">{addr}</p> : null}
                      {zipCity ? <p className="text-sm text-slate-600">{zipCity}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${unitTypeBadgeClasses(u.type)}`}
                      >
                        {typeLabel}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${unitStatusBadgeClasses(u.status)}`}
                      >
                        {u.status || "—"}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 mt-3 pt-3 border-t border-slate-100">
                    <span className="text-slate-500">Miete (Mieter): </span>
                    <span className="font-semibold tabular-nums text-slate-900">
                      {formatChfMonthly(u.tenantPriceMonthly)}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 shadow-sm bg-white p-5 md:p-6 mb-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Historie</h2>
        <p className="text-xs text-slate-500 mb-3">
          Basierend auf gespeicherten Stammdaten (kein vollständiges Audit-Protokoll).
        </p>
        <ul className="space-y-3 border-l-2 border-slate-200 pl-4 ml-1">
          <li>
            <p className="text-xs font-medium text-slate-500">Erstellt am</p>
            <p className="text-sm font-medium text-slate-900 mt-0.5">{formatDateTime(owner.created_at)}</p>
          </li>
          <li>
            <p className="text-xs font-medium text-slate-500">Zuletzt aktualisiert</p>
            <p className="text-sm font-medium text-slate-900 mt-0.5">
              {formatDateTime(owner.updated_at)}
            </p>
          </li>
          <li>
            <p className="text-xs font-medium text-slate-500">Status</p>
            <p className="text-sm font-medium text-slate-900 mt-0.5">
              {isOwnerActive ? "Aktiv" : "Inaktiv"}
            </p>
          </li>
        </ul>
      </section>

      {editOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 p-4"
          onClick={() => !editSaving && setEditOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-edit-title"
          >
            <h2 id="owner-edit-title" className="text-lg font-semibold text-slate-900 mb-4">
              Eigentümer bearbeiten
            </h2>
            <form onSubmit={submitEdit} className="space-y-4">
              <div>
                <label htmlFor="owner-edit-name" className="block text-xs font-medium text-slate-500 mb-1">
                  Name *
                </label>
                <input
                  id="owner-edit-name"
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={editSaving}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="owner-edit-email" className="block text-xs font-medium text-slate-500 mb-1">
                  E-Mail
                </label>
                <input
                  id="owner-edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={editSaving}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="owner-edit-phone" className="block text-xs font-medium text-slate-500 mb-1">
                  Telefon
                </label>
                <input
                  id="owner-edit-phone"
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  disabled={editSaving}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor="owner-edit-status" className="block text-xs font-medium text-slate-500 mb-1">
                  Status
                </label>
                <select
                  id="owner-edit-status"
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  disabled={editSaving}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 bg-white disabled:opacity-60"
                >
                  <option value="active">Aktiv</option>
                  <option value="inactive">Inaktiv</option>
                </select>
              </div>
              {editErr ? <p className="text-sm text-red-700">{editErr}</p> : null}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {editSaving ? "Speichern …" : "Speichern"}
                </button>
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setEditOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminOwnerDetailPage;
