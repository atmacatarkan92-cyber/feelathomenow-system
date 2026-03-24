import React, { useEffect, useState } from "react";
import { fetchAdminTenant, updateAdminTenant } from "../../../api/adminData";

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.35)",
  zIndex: 1000,
};

const drawerStyle = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: "min(480px, 100vw)",
  background: "#F8FAFC",
  zIndex: 1001,
  boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.12)",
  display: "flex",
  flexDirection: "column",
  borderLeft: "1px solid #E2E8F0",
};

const sectionCard = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: "14px",
  padding: "16px",
  marginBottom: "12px",
};

const placeholderStyle = {
  ...sectionCard,
  color: "#64748B",
  fontSize: "13px",
  textAlign: "center",
  padding: "20px",
};

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "#64748B",
  marginBottom: "4px",
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #E2E8F0",
  fontSize: "14px",
  boxSizing: "border-box",
};

function PlaceholderSection({ title }) {
  return (
    <div style={placeholderStyle}>
      <div style={{ fontWeight: 700, color: "#334155", marginBottom: "6px" }}>{title}</div>
      <div>Wird in einer späteren Phase ergänzt.</div>
    </div>
  );
}

/**
 * Right-side drawer: tenant detail, edit, and future CRM sections (placeholders).
 * @param {{ open: boolean, tenantId: string | null, statusMeta: object, onClose: () => void, onTenantUpdated: (tenant: object) => void }} props
 */
export default function TenantDetailDrawer({
  open,
  tenantId,
  statusMeta,
  onClose,
  onTenantUpdated,
}) {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });

  useEffect(() => {
    if (!open || !tenantId) {
      setTenant(null);
      setLoadError(null);
      setEditing(false);
      setSaveError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    fetchAdminTenant(tenantId)
      .then((t) => {
        if (!t) {
          setLoadError("Mieter nicht gefunden.");
          setTenant(null);
          return;
        }
        setTenant(t);
        setForm({
          name: t.name || t.full_name || "",
          email: t.email || "",
          phone: t.phone || "",
          company: t.company || "",
        });
      })
      .catch((e) => setLoadError(e?.message || "Laden fehlgeschlagen."))
      .finally(() => setLoading(false));
  }, [open, tenantId]);

  if (!open) return null;

  const applyUpdate = (updated) => {
    setTenant(updated);
    setForm({
      name: updated.name || updated.full_name || "",
      email: updated.email || "",
      phone: updated.phone || "",
      company: updated.company || "",
    });
    onTenantUpdated?.(updated);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaveError(null);
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setSaveError("Name ist erforderlich.");
      return;
    }
    setSaving(true);
    updateAdminTenant(tenantId, {
      name: trimmedName,
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
    })
      .then((updated) => {
        applyUpdate(updated);
        setEditing(false);
      })
      .catch((err) => setSaveError(err?.message || "Speichern fehlgeschlagen."))
      .finally(() => setSaving(false));
  };

  const displayName = tenant?.name || tenant?.full_name || "—";

  return (
    <>
      <div style={backdropStyle} aria-hidden onClick={onClose} />
      <aside style={drawerStyle} aria-label="Mieter-Details">
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #E2E8F0",
            background: "#FFFFFF",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "12px", color: "#f97316", fontWeight: 700 }}>
              Mieter
            </div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 800,
                margin: "4px 0 0 0",
                wordBreak: "break-word",
              }}
            >
              {loading ? "…" : displayName}
            </h2>
            {!loading && tenant && (
              <div style={{ marginTop: "10px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    padding: "6px 10px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 700,
                    background: statusMeta?.bg || "#F1F5F9",
                    color: statusMeta?.color || "#475569",
                    border: `1px solid ${statusMeta?.border || "#CBD5E1"}`,
                  }}
                >
                  {statusMeta?.label || "Status"}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            {!editing && tenant && !loadError ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setSaveError(null);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  background: "#FFFFFF",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Bearbeiten
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                background: "#F8FAFC",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Schließen
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
          {loading ? (
            <p style={{ color: "#64748B" }}>Lade Daten …</p>
          ) : loadError ? (
            <div
              style={{
                padding: "12px",
                borderRadius: "12px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#B91C1C",
              }}
            >
              {loadError}
            </div>
          ) : tenant ? (
            <>
              <div style={sectionCard}>
                {!editing ? (
                  <>
                    <div style={{ marginBottom: "12px" }}>
                      <span style={labelStyle}>E-Mail</span>
                      <div style={{ fontSize: "15px", color: "#0F172A" }}>
                        {tenant.email || "—"}
                      </div>
                    </div>
                    <div style={{ marginBottom: "12px" }}>
                      <span style={labelStyle}>Telefon</span>
                      <div style={{ fontSize: "15px", color: "#0F172A" }}>
                        {tenant.phone || "—"}
                      </div>
                    </div>
                    <div style={{ marginBottom: "12px" }}>
                      <span style={labelStyle}>Firma</span>
                      <div style={{ fontSize: "15px", color: "#0F172A" }}>
                        {tenant.company || "—"}
                      </div>
                    </div>
                    <div>
                      <span style={labelStyle}>Erfasst am</span>
                      <div style={{ fontSize: "15px", color: "#0F172A" }}>
                        {formatDateTime(tenant.created_at)}
                      </div>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleSave}>
                    <div style={{ marginBottom: "12px" }}>
                      <label htmlFor="td-name" style={labelStyle}>
                        Name *
                      </label>
                      <input
                        id="td-name"
                        style={inputStyle}
                        value={form.name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, name: e.target.value }))
                        }
                        disabled={saving}
                      />
                    </div>
                    <div style={{ marginBottom: "12px" }}>
                      <label htmlFor="td-email" style={labelStyle}>
                        E-Mail
                      </label>
                      <input
                        id="td-email"
                        type="email"
                        style={inputStyle}
                        value={form.email}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, email: e.target.value }))
                        }
                        disabled={saving}
                      />
                    </div>
                    <div style={{ marginBottom: "12px" }}>
                      <label htmlFor="td-phone" style={labelStyle}>
                        Telefon
                      </label>
                      <input
                        id="td-phone"
                        style={inputStyle}
                        value={form.phone}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, phone: e.target.value }))
                        }
                        disabled={saving}
                      />
                    </div>
                    <div style={{ marginBottom: "14px" }}>
                      <label htmlFor="td-company" style={labelStyle}>
                        Firma
                      </label>
                      <input
                        id="td-company"
                        style={inputStyle}
                        value={form.company}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, company: e.target.value }))
                        }
                        disabled={saving}
                      />
                    </div>
                    {saveError ? (
                      <div
                        style={{
                          marginBottom: "12px",
                          fontSize: "13px",
                          color: "#B91C1C",
                        }}
                      >
                        {saveError}
                      </div>
                    ) : null}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="submit"
                        disabled={saving}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "10px",
                          border: "none",
                          background: saving ? "#94A3B8" : "#f97316",
                          color: "#FFF",
                          fontWeight: 700,
                          cursor: saving ? "default" : "pointer",
                        }}
                      >
                        {saving ? "Speichern …" : "Speichern"}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setEditing(false);
                          setSaveError(null);
                          setForm({
                            name: tenant.name || tenant.full_name || "",
                            email: tenant.email || "",
                            phone: tenant.phone || "",
                            company: tenant.company || "",
                          });
                        }}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "10px",
                          border: "1px solid #E2E8F0",
                          background: "#FFF",
                          fontWeight: 600,
                          cursor: saving ? "default" : "pointer",
                        }}
                      >
                        Abbrechen
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div style={{ marginTop: "8px", marginBottom: "8px", fontWeight: 700, color: "#334155", fontSize: "13px" }}>
                Verknüpfungen &amp; CRM
              </div>
              <PlaceholderSection title="Mietverhältnisse" />
              <PlaceholderSection title="Rechnungen" />
              <PlaceholderSection title="Notizen" />
              <PlaceholderSection title="Verlauf / Audit" />
              <PlaceholderSection title="Dokumente" />
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}
