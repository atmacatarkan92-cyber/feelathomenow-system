import React, { useEffect, useState } from "react";
import { createAdminTenant } from "../../../api/adminData";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
};

const panelStyle = {
  background: "#FFFFFF",
  borderRadius: "18px",
  border: "1px solid #E5E7EB",
  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.12)",
  width: "100%",
  maxWidth: "440px",
  padding: "24px",
};

const labelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "#334155",
  marginBottom: "6px",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #E2E8F0",
  fontSize: "14px",
  boxSizing: "border-box",
};

/**
 * Modal to create a tenant (name required; email optional with validation).
 */
export default function TenantCreateModal({ open, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setError(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Bitte einen Namen eingeben.");
      return;
    }
    setSubmitting(true);
    const body = {
      name: trimmedName,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
    };
    createAdminTenant(body)
      .then((created) => {
        onCreated?.(created);
        onClose?.();
      })
      .catch((err) => {
        setError(err?.message || "Mieter konnte nicht erstellt werden.");
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <div style={overlayStyle} role="presentation" onClick={onClose}>
      <div
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-create-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="tenant-create-title"
          style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px 0" }}
        >
          Neuer Mieter
        </h2>
        <p style={{ color: "#64748B", fontSize: "14px", margin: "0 0 20px 0" }}>
          Pflichtfeld ist der Name. E-Mail wird geprüft, wenn ausgefüllt.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="tc-name" style={labelStyle}>
              Name *
            </label>
            <input
              id="tc-name"
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              disabled={submitting}
            />
          </div>
          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="tc-email" style={labelStyle}>
              E-Mail
            </label>
            <input
              id="tc-email"
              type="email"
              style={inputStyle}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={submitting}
            />
          </div>
          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="tc-phone" style={labelStyle}>
              Telefon
            </label>
            <input
              id="tc-phone"
              style={inputStyle}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              disabled={submitting}
            />
          </div>
          <div style={{ marginBottom: "18px" }}>
            <label htmlFor="tc-company" style={labelStyle}>
              Firma
            </label>
            <input
              id="tc-company"
              style={inputStyle}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              autoComplete="organization"
              disabled={submitting}
            />
          </div>

          {error ? (
            <div
              style={{
                marginBottom: "14px",
                padding: "10px 12px",
                borderRadius: "10px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#B91C1C",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                background: "#FFFFFF",
                fontWeight: 600,
                cursor: submitting ? "default" : "pointer",
              }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "none",
                background: submitting ? "#94A3B8" : "#f97316",
                color: "#FFFFFF",
                fontWeight: 700,
                cursor: submitting ? "default" : "pointer",
              }}
            >
              {submitting ? "Speichern …" : "Anlegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
