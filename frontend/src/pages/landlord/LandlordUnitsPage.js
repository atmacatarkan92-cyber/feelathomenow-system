import React, { useEffect, useState } from "react";
import { fetchLandlordUnits, fetchLandlordProperties, createLandlordUnit } from "../../api/landlordApi";

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #E5E7EB",
  fontSize: "14px",
  boxSizing: "border-box",
};
const labelStyle = { display: "block", marginBottom: "4px", fontSize: "13px", fontWeight: 600, color: "#374151" };

function LandlordUnitsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [properties, setProperties] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    property_id: "",
    title: "",
    address: "",
    city: "",
    rooms: 0,
    type: "",
  });

  const loadUnits = () => {
    setError("");
    return fetchLandlordUnits()
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || "Einheiten konnten nicht geladen werden."));
  };

  useEffect(() => {
    setLoading(true);
    loadUnits().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (showCreate && properties.length === 0) {
      fetchLandlordProperties()
        .then((data) => setProperties(Array.isArray(data) ? data : []))
        .catch(() => setProperties([]));
    }
  }, [showCreate, properties.length]);

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    setCreateError("");
    setSubmitting(true);
    const payload = {
      property_id: form.property_id,
      title: form.title.trim() || "New Unit",
      address: form.address.trim(),
      city: form.city.trim(),
      rooms: Number(form.rooms) || 0,
    };
    if (form.type.trim()) payload.type = form.type.trim();
    createLandlordUnit(payload)
      .then(() => {
        setSuccessMessage("Einheit wurde erstellt.");
        setForm({ property_id: "", title: "", address: "", city: "", rooms: 0, type: "" });
        setShowCreate(false);
        return loadUnits();
      })
      .then(() => {
        setTimeout(() => setSuccessMessage(""), 3000);
      })
      .catch((e) => setCreateError(e.message || "Einheit konnte nicht erstellt werden."))
      .finally(() => setSubmitting(false));
  };

  if (loading) return <p style={{ color: "#64748B" }}>Lade …</p>;
  if (error) return <p style={{ color: "#B91C1C" }}>{error}</p>;

  return (
    <div>
      <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 16px 0", color: "#0F172A" }}>
        Meine Units
      </h2>
      {successMessage && (
        <p style={{ color: "#15803D", marginBottom: "12px", fontSize: "14px" }}>{successMessage}</p>
      )}
      <div style={{ marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => { setShowCreate(!showCreate); setCreateError(""); setSuccessMessage(""); }}
          style={{
            padding: "8px 16px",
            background: "#0F172A",
            color: "#FFF",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          {showCreate ? "Abbrechen" : "Neue Einheit"}
        </button>
      </div>
      {showCreate && (
        <form
          onSubmit={handleCreateSubmit}
          style={{
            padding: "20px",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            marginBottom: "20px",
            maxWidth: "480px",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px 0", color: "#475569" }}>
            Neue Einheit anlegen
          </h3>
          {createError && (
            <p style={{ color: "#B91C1C", marginBottom: "12px", fontSize: "14px" }}>{createError}</p>
          )}
          <div style={{ display: "grid", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Objekt *</label>
              <select
                value={form.property_id}
                onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
                required
                style={inputStyle}
              >
                <option value="">— Objekt wählen —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.title || p.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Titel / Name *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="z. B. Wohnung 1"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Adresse</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Strasse, Nr."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Stadt *</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="z. B. Zürich"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Zimmer</label>
              <input
                type="number"
                min="0"
                value={form.rooms}
                onChange={(e) => setForm((f) => ({ ...f, rooms: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Typ (optional)</label>
              <input
                type="text"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                placeholder="z. B. Wohnung, Studio"
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !form.property_id}
              style={{
                padding: "10px 20px",
                background: submitting ? "#94A3B8" : "#0F172A",
                color: "#FFF",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Wird erstellt…" : "Einheit erstellen"}
            </button>
          </div>
        </form>
      )}
      {list.length === 0 ? (
        <p style={{ color: "#64748B" }}>Keine Einheiten vorhanden.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E5E7EB", textAlign: "left" }}>
                <th style={{ padding: "12px 8px", color: "#64748B" }}>Titel</th>
                <th style={{ padding: "12px 8px", color: "#64748B" }}>Adresse</th>
                <th style={{ padding: "12px 8px", color: "#64748B" }}>Stadt</th>
                <th style={{ padding: "12px 8px", color: "#64748B" }}>Zimmer</th>
                <th style={{ padding: "12px 8px", color: "#64748B" }}>Typ</th>
                <th style={{ padding: "12px 8px", color: "#64748B" }}>Objekt</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 600 }}>{u.title || u.name || "—"}</td>
                  <td style={{ padding: "12px 8px" }}>{u.address || "—"}</td>
                  <td style={{ padding: "12px 8px" }}>{u.city || "—"}</td>
                  <td style={{ padding: "12px 8px" }}>{u.rooms ?? "—"}</td>
                  <td style={{ padding: "12px 8px" }}>{u.type || "—"}</td>
                  <td style={{ padding: "12px 8px" }}>{u.property_title || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default LandlordUnitsPage;
