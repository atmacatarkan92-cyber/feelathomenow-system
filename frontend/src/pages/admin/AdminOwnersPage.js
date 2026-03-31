import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createAdminOwner, fetchAdminOwners } from "../../api/adminData";

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getCardStyle(accentColor) {
  return {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderTop: `4px solid ${accentColor}`,
    borderRadius: "18px",
    padding: "20px",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
  };
}

function AdminOwnersPage() {
  const [items, setItems] = useState([]);
  const [ownersWithUnitsCount, setOwnersWithUnitsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [listFilter, setListFilter] = useState("active");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);

  const load = (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError("");
    fetchAdminOwners()
      .then((data) => {
        setItems(Array.isArray(data.items) ? data.items : []);
        setOwnersWithUnitsCount(
          typeof data.owners_with_units_count === "number" ? data.owners_with_units_count : 0
        );
      })
      .catch((e) => {
        setError(e.message || "Fehler beim Laden.");
        setItems([]);
        setOwnersWithUnitsCount(0);
      })
      .finally(() => {
        if (showSpinner) setLoading(false);
      });
  };

  useEffect(() => {
    load(true);
  }, []);

  const openCreate = () => {
    setError("");
    setForm({
      name: "",
      email: "",
      phone: "",
      status: "active",
    });
    setFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      status: form.status === "inactive" ? "inactive" : "active",
    };
    createAdminOwner(body)
      .then(() => {
        setFormOpen(false);
        load(false);
      })
      .catch((err) => setError(err.message || "Speichern fehlgeschlagen."))
      .finally(() => setSaving(false));
  };

  const statusFilteredItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.filter((item) => {
      const s = String(item.status || "active").toLowerCase();
      if (listFilter === "active") return s !== "inactive";
      if (listFilter === "inactive") return s === "inactive";
      return true;
    });
  }, [items, listFilter]);

  const filteredRows = useMemo(() => {
    let result = [...statusFilteredItems];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return result;
    return result.filter((item) => {
      const blob = `${item.name || ""} ${item.email || ""} ${item.phone || ""}`.toLowerCase();
      return blob.includes(term);
    });
  }, [statusFilteredItems, searchTerm]);

  const summary = useMemo(() => {
    const totalCount = items.length;
    const activeCount = items.filter(
      (i) => String(i.status || "active").toLowerCase() !== "inactive"
    ).length;
    const inactiveCount = items.filter((i) => String(i.status || "").toLowerCase() === "inactive").length;
    return { totalCount, activeCount, inactiveCount };
  }, [items]);

  if (loading) {
    return (
      <div style={{ padding: "24px" }}>
        <p style={{ color: "#64748B" }}>Lade Eigentümer …</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div>
        <div
          style={{
            fontSize: "12px",
            color: "#f97316",
            fontWeight: 700,
            marginBottom: "8px",
          }}
        >
          Vantio
        </div>

        <h2 style={{ fontSize: "36px", fontWeight: 800, margin: 0 }}>Eigentümer</h2>

        <p style={{ color: "#64748B", marginTop: "10px" }}>
          Verwaltung von Eigentümer-Kontakten (CRM).
        </p>
      </div>

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "12px",
            padding: "12px 16px",
            color: "#B91C1C",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <div style={getCardStyle("#334155")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
            Eigentümer gesamt
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#0F172A" }}>{summary.totalCount}</div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            Alle erfassten Kontakte
          </div>
        </div>

        <div style={getCardStyle("#16A34A")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>Aktiv</div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#166534" }}>{summary.activeCount}</div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>Status aktiv</div>
        </div>

        <div style={getCardStyle("#64748B")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>Inaktiv</div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#334155" }}>{summary.inactiveCount}</div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>Status inaktiv</div>
        </div>

        <div style={getCardStyle("#2563EB")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>Mit Units</div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#1D4ED8" }}>{ownersWithUnitsCount}</div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            Mindestens eine Unit zugeordnet
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "18px",
          padding: "20px",
          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              flex: "1 1 280px",
              minWidth: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              alignItems: "flex-end",
            }}
          >
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "#64748B",
                  marginBottom: "8px",
                  fontWeight: 600,
                }}
              >
                Suche
              </label>
              <input
                type="text"
                placeholder="Nach Name, E-Mail oder Telefon suchen"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  height: "44px",
                  borderRadius: "12px",
                  border: "1px solid #D1D5DB",
                  padding: "0 14px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: "0 1 180px", minWidth: "min(100%, 160px)" }}>
              <label
                htmlFor="owners-list-filter"
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "#64748B",
                  marginBottom: "8px",
                  fontWeight: 600,
                }}
              >
                Anzeige
              </label>
              <select
                id="owners-list-filter"
                value={listFilter}
                onChange={(e) => setListFilter(e.target.value)}
                aria-label="Anzeige"
                style={{
                  width: "100%",
                  height: "44px",
                  borderRadius: "12px",
                  border: "1px solid #D1D5DB",
                  padding: "0 12px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  background: "#FFFFFF",
                  color: "#0F172A",
                }}
              >
                <option value="active">Aktiv</option>
                <option value="inactive">Inaktiv</option>
                <option value="all">Alle</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            style={{
              height: "44px",
              padding: "0 18px",
              borderRadius: "12px",
              border: "none",
              background: "#0F172A",
              color: "#FFF",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            + Neuer Eigentümer
          </button>
        </div>
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "18px",
          padding: "20px",
          overflowX: "auto",
          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Eigentümerübersicht</h3>
          <div style={{ fontSize: "14px", color: "#64748B" }}>{filteredRows.length} Einträge</div>
        </div>

        {filteredRows.length === 0 ? (
          <p style={{ color: "#64748B" }}>Keine Eigentümer gefunden.</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #E5E7EB",
                  color: "#64748B",
                }}
              >
                <th style={{ padding: "12px" }}>Name</th>
                <th style={{ padding: "12px" }}>E-Mail</th>
                <th style={{ padding: "12px" }}>Telefon</th>
                <th style={{ padding: "12px" }}>Status</th>
                <th style={{ padding: "12px" }}>Erstellt</th>
                <th style={{ padding: "12px", whiteSpace: "nowrap" }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((item) => {
                const isActive = String(item.status || "active").toLowerCase() !== "inactive";
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px", fontWeight: 700, color: "#0F172A" }}>
                      {item.name || "—"}
                    </td>
                    <td style={{ padding: "12px" }}>{item.email || "—"}</td>
                    <td style={{ padding: "12px" }}>{item.phone || "—"}</td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: isActive ? "#ECFDF5" : "#F1F5F9",
                          color: isActive ? "#166534" : "#64748B",
                          border: isActive ? "1px solid #A7F3D0" : "1px solid #E2E8F0",
                        }}
                      >
                        {isActive ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>{formatDate(item.created_at)}</td>
                    <td style={{ padding: "12px" }}>
                      <Link
                        to={`/admin/owners/${encodeURIComponent(item.id)}`}
                        style={{
                          display: "inline-block",
                          padding: "6px 12px",
                          background: "#0F172A",
                          color: "#FFF",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        Öffnen
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => !saving && setFormOpen(false)}
        >
          <div
            style={{
              background: "#FFF",
              padding: "24px",
              borderRadius: "18px",
              maxWidth: "440px",
              width: "100%",
              boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
              border: "1px solid #E5E7EB",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "16px", fontSize: "20px", fontWeight: 700 }}>Neuer Eigentümer</h3>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid #D1D5DB",
                    fontSize: "14px",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  E-Mail (optional)
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid #D1D5DB",
                    fontSize: "14px",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  Telefon (optional)
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid #D1D5DB",
                    fontSize: "14px",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid #D1D5DB",
                    fontSize: "14px",
                    background: "#fff",
                  }}
                >
                  <option value="active">Aktiv</option>
                  <option value="inactive">Inaktiv</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "12px",
                    border: "none",
                    background: "#EA580C",
                    color: "#FFF",
                    fontWeight: 600,
                    cursor: saving ? "wait" : "pointer",
                  }}
                >
                  {saving ? "Speichern…" : "Speichern"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setFormOpen(false)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
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

export default AdminOwnersPage;
