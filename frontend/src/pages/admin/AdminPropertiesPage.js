import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchAdminProperties,
  fetchAdminLandlords,
  createAdminProperty,
  updateAdminProperty,
  geocodeAdminProperty,
} from "../../api/adminData";

function geocodingStatusPresentation(meta, snapshot, isCreate) {
  if (isCreate) {
    return {
      text: "Geocoding: Noch nicht berechnet",
      className: "text-[11px] text-[#64748b] dark:text-[#6b7a9a]",
    };
  }
  if (meta) {
    if (meta.status === "ok") {
      return {
        text: "Geocoding: Erfolgreich",
        className: "text-[11px] font-medium text-emerald-600 dark:text-emerald-400",
      };
    }
    if (meta.status === "skipped") {
      if (meta.reason === "unchanged") {
        return {
          text: "Geocoding: Adresse unverändert",
          className: "text-[11px] text-[#64748b] dark:text-[#6b7a9a]",
        };
      }
      if (meta.reason === "incomplete_address") {
        return {
          text: "Geocoding: Unvollständig",
          className: "text-[11px] font-medium text-amber-600 dark:text-amber-400/95",
        };
      }
      if (meta.reason === "provider_unavailable") {
        return {
          text: "Geocoding: Nicht verfügbar",
          className: "text-[11px] font-medium text-amber-700 dark:text-amber-500/90",
        };
      }
      return {
        text: "Geocoding: Übersprungen",
        className: "text-[11px] text-[#64748b] dark:text-[#6b7a9a]",
      };
    }
    if (meta.status === "failed") {
      return {
        text: "Geocoding: Fehlgeschlagen",
        className: "text-[11px] font-medium text-red-600 dark:text-red-400/95",
      };
    }
  }
  if (snapshot && snapshot.lat != null && snapshot.lng != null) {
    return {
      text: "Geocoding: Koordinaten vorhanden",
      className: "text-[11px] text-emerald-600/95 dark:text-emerald-400/85",
    };
  }
  return {
    text: "Geocoding: Noch nicht berechnet",
    className: "text-[11px] text-[#64748b] dark:text-[#6b7a9a]",
  };
}

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = {
  textAlign: "left",
  padding: "12px 8px",
  fontSize: "9px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
};
const thClass =
  "border-b border-black/10 dark:border-white/[0.05] bg-slate-100 dark:bg-[#111520] text-[#64748b] dark:text-[#6b7a9a]";
const tdStyle = {
  padding: "12px 8px",
};
const tdClass = "border-b border-black/10 dark:border-white/[0.05] text-[#0f172a] dark:text-[#eef2ff]";
const inputClass =
  "w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-2.5 py-2 text-sm text-[#0f172a] dark:text-[#eef2ff]";
const labelClass = "mb-1 block text-[10px] font-medium text-[#64748b] dark:text-[#6b7a9a]";

function AdminPropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    landlord_id: "",
    title: "",
    street: "",
    house_number: "",
    zip_code: "",
    city: "",
    country: "CH",
    status: "active",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [lastGeocodingMeta, setLastGeocodingMeta] = useState(null);
  const [coordinateSnapshot, setCoordinateSnapshot] = useState(null);
  const [geocodingRetrying, setGeocodingRetrying] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([fetchAdminProperties(), fetchAdminLandlords()])
      .then(([props, lords]) => {
        setProperties(props);
        setLandlords(lords || []);
      })
      .catch((e) => setError(e.message || "Fehler beim Laden."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setLastGeocodingMeta(null);
    setCoordinateSnapshot(null);
    setForm({
      landlord_id: "",
      title: "",
      street: "",
      house_number: "",
      zip_code: "",
      city: "",
      country: "CH",
      status: "active",
      notes: "",
    });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setLastGeocodingMeta(null);
    setCoordinateSnapshot(
      row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : { lat: null, lng: null }
    );
    setForm({
      landlord_id: row.landlord_id || "",
      title: row.title || "",
      street: row.street || "",
      house_number: row.house_number || "",
      zip_code: row.zip_code || "",
      city: row.city || "",
      country: row.country || "CH",
      status: row.status || "active",
      notes: row.notes || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      landlord_id: form.landlord_id.trim() || null,
      title: form.title.trim() || "—",
      street: form.street.trim() || null,
      house_number: form.house_number.trim() || null,
      zip_code: form.zip_code.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || "CH",
      status: form.status.trim() || "active",
      notes: form.notes.trim() || null,
    };
    const promise = editingId
      ? updateAdminProperty(editingId, body)
      : createAdminProperty(body);
    promise
      .then((data) => {
        if (data) {
          setLastGeocodingMeta(data.geocoding ?? null);
          setCoordinateSnapshot(
            data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : { lat: null, lng: null }
          );
        }
        const g = data && data.geocoding;
        if (
          g &&
          g.status !== "ok" &&
          g.reason &&
          g.reason !== "unchanged"
        ) {
          const reason = g.reason;
          let msg =
            "Liegenschaft gespeichert, aber Koordinaten konnten nicht automatisch ermittelt werden.";
          if (reason === "incomplete_address") {
            msg =
              "Liegenschaft gespeichert, aber die Adresse war für die automatische Kartenposition unvollständig.";
          } else if (reason === "provider_unavailable") {
            msg =
              "Liegenschaft gespeichert, aber Koordinaten konnten nicht automatisch ermittelt werden (Geocoding nicht konfiguriert).";
          }
          toast.warning(msg);
        }
        setFormOpen(false);
        load();
      })
      .catch((e) => setError(e.message || "Speichern fehlgeschlagen."))
      .finally(() => setSaving(false));
  };

  const handleRetryGeocode = () => {
    if (!editingId || geocodingRetrying) return;
    setGeocodingRetrying(true);
    geocodeAdminProperty(editingId)
      .then((data) => {
        setLastGeocodingMeta(data.geocoding ?? null);
        setCoordinateSnapshot(
          data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : { lat: null, lng: null }
        );
        const g = data.geocoding;
        if (g && g.status === "ok") {
          toast.success("Koordinaten erfolgreich aktualisiert.");
        } else if (g && g.reason === "incomplete_address") {
          toast.warning("Adresse unvollständig – Koordinaten konnten nicht ermittelt werden.");
        } else if (g && g.reason === "provider_unavailable") {
          toast.warning("Geocoding nicht verfügbar.");
        } else {
          toast.warning("Koordinaten konnten nicht automatisch ermittelt werden.");
        }
        load();
      })
      .catch((e) => toast.error(e.message || "Geocoding fehlgeschlagen."))
      .finally(() => setGeocodingRetrying(false));
  };

  const geoPresent = geocodingStatusPresentation(lastGeocodingMeta, coordinateSnapshot, !editingId);

  const getLandlordLabel = (id) => {
    if (!id) return "—";
    const l = landlords.find((x) => String(x.id) === String(id));
    return l ? (l.company_name || l.contact_name || l.email || id) : id;
  };

  if (loading) {
    return (
      <p className="min-h-[40vh] bg-[#f8fafc] px-2 py-8 text-[#64748b] dark:bg-[#07090f] dark:text-[#6b7a9a]">Lade Liegenschaften …</p>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] px-2 py-4 text-[#0f172a] [color-scheme:light] dark:bg-[#07090f] dark:text-[#eef2ff] dark:[color-scheme:dark]">
      <h2 className="mb-4 text-[22px] font-bold">Liegenschaften (Properties)</h2>
      {error && (
        <p className="mb-3 text-[14px] text-[#f87171]">{error}</p>
      )}
      <div className="mb-4">
        <button
          type="button"
          onClick={openCreate}
          className="rounded-[8px] border-none bg-gradient-to-r from-[#5b8cff] to-[#7c5cfc] px-4 py-2.5 font-semibold text-white hover:opacity-95"
        >
          + Neue Liegenschaft
        </button>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-black/10 dark:border-white/[0.07] bg-white dark:bg-[#141824]">
      <table style={tableStyle}>
        <thead>
          <tr>
            <th className={thClass} style={thStyle}>Titel</th>
            <th className={thClass} style={thStyle}>Adresse</th>
            <th className={thClass} style={thStyle}>Vermieter</th>
            <th className={thClass} style={thStyle}>Status</th>
            <th className={thClass} style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {properties.length === 0 ? (
            <tr>
              <td colSpan={5} className={`${tdClass} text-[#64748b] dark:text-[#6b7a9a]`} style={tdStyle}>
                Noch keine Einträge. Erstellen Sie eine neue Liegenschaft.
              </td>
            </tr>
          ) : (
            properties.map((row) => (
              <tr key={row.id}>
                <td className={tdClass} style={tdStyle}>{row.title || "—"}</td>
                <td className={tdClass} style={tdStyle}>
                  {[row.street, row.house_number, [row.zip_code, row.city].filter(Boolean).join(" ")]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </td>
                <td className={tdClass} style={tdStyle}>{getLandlordLabel(row.landlord_id)}</td>
                <td className={tdClass} style={tdStyle}>{row.status || "—"}</td>
                <td className={tdClass} style={tdStyle}>
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="cursor-pointer rounded-[8px] border border-black/10 dark:border-white/[0.1] bg-transparent px-3 py-2 text-[13px] font-semibold text-[#8090b0] hover:bg-white/[0.04]"
                  >
                    Bearbeiten
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60"
          onClick={() => !saving && setFormOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-[420px] overflow-auto rounded-[14px] border border-black/10 dark:border-white/[0.07] bg-white dark:bg-[#141824] p-6 [color-scheme:light] dark:[color-scheme:dark]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-[18px] font-bold text-[#0f172a] dark:text-[#eef2ff]">
              {editingId ? "Liegenschaft bearbeiten" : "Neue Liegenschaft"}
            </h3>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px" }}>
              <div>
                <label className={labelClass}>Titel *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={inputClass}
                  required
                  placeholder="z.B. Haus Musterstrasse"
                />
              </div>
              <div>
                <label className={labelClass}>Vermieter (optional)</label>
                <select
                  value={form.landlord_id}
                  onChange={(e) => setForm((f) => ({ ...f, landlord_id: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">— Keiner —</option>
                  {landlords.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.company_name || l.contact_name || l.email || l.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Strasse (optional)</label>
                <input
                  type="text"
                  value={form.street}
                  onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Hausnummer (optional)</label>
                <input
                  type="text"
                  value={form.house_number}
                  onChange={(e) => setForm((f) => ({ ...f, house_number: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>PLZ / Ort (optional)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "8px" }}>
                  <input
                    type="text"
                    value={form.zip_code}
                    onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))}
                    className={inputClass}
                    placeholder="PLZ"
                  />
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className={inputClass}
                    placeholder="Ort"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Land (optional)</label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <p className={geoPresent.className}>{geoPresent.text}</p>
              {editingId ? (
                <div>
                  <button
                    type="button"
                    disabled={saving || geocodingRetrying}
                    onClick={handleRetryGeocode}
                    className="rounded-[8px] border border-black/10 bg-slate-100 px-3 py-2 text-[12px] font-semibold text-[#0f172a] transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.12] dark:bg-[#111520] dark:text-[#eef2ff] dark:hover:bg-white/[0.08]"
                  >
                    {geocodingRetrying ? "Berechne …" : "Koordinaten erneut berechnen"}
                  </button>
                </div>
              ) : null}
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className={inputClass}
                >
                  <option value="active">Aktiv</option>
                  <option value="inactive">Inaktiv</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Notizen (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className={inputClass}
                  style={{ minHeight: "60px" }}
                  rows={2}
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-[8px] border-none bg-gradient-to-r from-[#5b8cff] to-[#7c5cfc] px-4 py-2.5 font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Speichern …" : "Speichern"}
                </button>
                <button
                  type="button"
                  onClick={() => !saving && setFormOpen(false)}
                  className="rounded-[8px] border border-black/10 dark:border-white/[0.1] bg-transparent px-4 py-2.5 font-semibold text-[#8090b0] hover:bg-white/[0.04]"
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

export default AdminPropertiesPage;
