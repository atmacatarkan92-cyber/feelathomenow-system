import React, { useEffect, useState } from "react";
import {
  fetchAdminProperties,
  fetchAdminLandlords,
  createAdminProperty,
  updateAdminProperty,
} from "../../api/adminData";

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
      .then(() => {
        setFormOpen(false);
        load();
      })
      .catch((e) => setError(e.message || "Speichern fehlgeschlagen."))
      .finally(() => setSaving(false));
  };

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
