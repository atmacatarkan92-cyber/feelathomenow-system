import React, { useEffect, useState } from "react";
import { createAdminTenant, verifyAdminAddress } from "../../../api/adminData";
import { buildGoogleMapsSearchUrl } from "../../../utils/googleMapsUrl";

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
  maxWidth: "560px",
  maxHeight: "90vh",
  overflowY: "auto",
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

const sectionTitle = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#f97316",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  margin: "20px 0 12px 0",
  borderBottom: "1px solid #F1F5F9",
  paddingBottom: "8px",
};

function SectionHeading({ children }) {
  return <div style={sectionTitle}>{children}</div>;
}

const initialForm = () => ({
  firstName: "",
  lastName: "",
  birthDate: "",
  nationality: "",
  isSwiss: null,
  residencePermit: "",
  email: "",
  phone: "",
  company: "",
  street: "",
  postalCode: "",
  city: "",
  country: "CH",
});

/**
 * Create tenant: grouped master data (personal, residency, contact, address).
 */
export default function TenantCreateModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [addressCheckBusy, setAddressCheckBusy] = useState(false);
  const [addressCheckHint, setAddressCheckHint] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm());
    setError(null);
    setSubmitting(false);
    setAddressCheckBusy(false);
    setAddressCheckHint(null);
  }, [open]);

  if (!open) return null;

  const set = (key) => (e) => {
    if (key === "isSwiss") {
      const raw = e.target.value;
      const v = raw === "" ? null : raw === "true";
      setForm((f) => {
        const next = { ...f, isSwiss: v };
        if (v === true) next.residencePermit = "";
        return next;
      });
      return;
    }
    const v = e.target.value;
    setForm((f) => ({ ...f, [key]: v }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    const fn = form.firstName.trim();
    const ln = form.lastName.trim();
    if (!fn || !ln) {
      setError("Bitte Vor- und Nachnamen eingeben.");
      return;
    }
    setSubmitting(true);
    const body = {
      first_name: fn,
      last_name: ln,
      birth_date: form.birthDate.trim() || undefined,
      nationality: form.nationality.trim() || undefined,
      ...(form.isSwiss === null ? {} : { is_swiss: form.isSwiss }),
      residence_permit:
        form.isSwiss === true
          ? undefined
          : form.residencePermit
            ? form.residencePermit
            : undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      company: form.company.trim() || undefined,
      street: form.street.trim() || undefined,
      postal_code: form.postalCode.trim() || undefined,
      city: form.city.trim() || undefined,
      country: (form.country.trim() || "CH") || undefined,
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
        <p style={{ color: "#64748B", fontSize: "14px", margin: "0 0 8px 0" }}>
          Stammdaten erfassen. Vor- und Nachname sind Pflichtfelder.
        </p>

        <form onSubmit={handleSubmit}>
          <SectionHeading>Person</SectionHeading>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label htmlFor="tc-fn" style={labelStyle}>
                Vorname *
              </label>
              <input
                id="tc-fn"
                style={inputStyle}
                value={form.firstName}
                onChange={set("firstName")}
                autoComplete="given-name"
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="tc-ln" style={labelStyle}>
                Nachname *
              </label>
              <input
                id="tc-ln"
                style={inputStyle}
                value={form.lastName}
                onChange={set("lastName")}
                autoComplete="family-name"
                disabled={submitting}
              />
            </div>
          </div>
          <div style={{ marginTop: "12px" }}>
            <label htmlFor="tc-bd" style={labelStyle}>
              Geburtsdatum
            </label>
            <input
              id="tc-bd"
              type="date"
              style={inputStyle}
              value={form.birthDate}
              onChange={set("birthDate")}
              disabled={submitting}
            />
          </div>
          <div style={{ marginTop: "12px" }}>
            <label htmlFor="tc-nat" style={labelStyle}>
              Nationalität
            </label>
            <input
              id="tc-nat"
              style={inputStyle}
              value={form.nationality}
              onChange={set("nationality")}
              disabled={submitting}
            />
          </div>

          <SectionHeading>Aufenthalt</SectionHeading>
          <div style={{ marginBottom: "12px" }}>
            <label htmlFor="tc-swiss" style={labelStyle}>
              Schweizer/in
            </label>
            <select
              id="tc-swiss"
              style={{ ...inputStyle, cursor: submitting ? "default" : "pointer" }}
              value={
                form.isSwiss === null ? "" : form.isSwiss === true ? "true" : "false"
              }
              onChange={set("isSwiss")}
              disabled={submitting}
            >
              <option value="">Unbekannt</option>
              <option value="true">Ja</option>
              <option value="false">Nein</option>
            </select>
          </div>
          {form.isSwiss !== true ? (
            <div style={{ marginTop: "12px" }}>
              <label htmlFor="tc-permit" style={labelStyle}>
                Aufenthaltsbewilligung
              </label>
              <select
                id="tc-permit"
                style={{ ...inputStyle, cursor: submitting ? "default" : "pointer" }}
                value={form.residencePermit}
                onChange={set("residencePermit")}
                disabled={submitting}
              >
                <option value="">—</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="L">L</option>
                <option value="G">G</option>
                <option value="Other">Other</option>
              </select>
            </div>
          ) : null}

          <SectionHeading>Kontakt</SectionHeading>
          <div style={{ marginBottom: "12px" }}>
            <label htmlFor="tc-email" style={labelStyle}>
              E-Mail
            </label>
            <input
              id="tc-email"
              type="email"
              style={inputStyle}
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
              disabled={submitting}
            />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label htmlFor="tc-phone" style={labelStyle}>
              Telefon
            </label>
            <input
              id="tc-phone"
              style={inputStyle}
              value={form.phone}
              onChange={set("phone")}
              autoComplete="tel"
              disabled={submitting}
            />
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label htmlFor="tc-company" style={labelStyle}>
              Firma
            </label>
            <input
              id="tc-company"
              style={inputStyle}
              value={form.company}
              onChange={set("company")}
              autoComplete="organization"
              disabled={submitting}
            />
          </div>

          <SectionHeading>Adresse</SectionHeading>
          <div style={{ marginBottom: "12px" }}>
            <label htmlFor="tc-street" style={labelStyle}>
              Strasse
            </label>
            <input
              id="tc-street"
              style={inputStyle}
              value={form.street}
              onChange={set("street")}
              autoComplete="street-address"
              disabled={submitting}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
            <div>
              <label htmlFor="tc-plz" style={labelStyle}>
                PLZ
              </label>
              <input
                id="tc-plz"
                style={inputStyle}
                value={form.postalCode}
                onChange={set("postalCode")}
                autoComplete="postal-code"
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="tc-city" style={labelStyle}>
                Ort
              </label>
              <input
                id="tc-city"
                style={inputStyle}
                value={form.city}
                onChange={set("city")}
                autoComplete="address-level2"
                disabled={submitting}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              marginTop: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  window.open(
                    buildGoogleMapsSearchUrl(form.street, form.postalCode, form.city),
                    "_blank",
                    "noopener,noreferrer"
                  );
                  setAddressCheckBusy(true);
                  setAddressCheckHint(null);
                  verifyAdminAddress({
                    address_line1: form.street,
                    postal_code: form.postalCode,
                    city: form.city,
                  })
                    .then((res) => {
                      if (res?.valid) {
                        setAddressCheckHint("Adresse bestätigt.");
                      } else {
                        setAddressCheckHint(
                          "Adresse konnte nicht automatisch bestätigt werden."
                        );
                      }
                    })
                    .catch(() =>
                      setAddressCheckHint(
                        "Adresse konnte nicht automatisch geprüft werden."
                      )
                    )
                    .finally(() => setAddressCheckBusy(false));
                }}
                disabled={
                  submitting ||
                  addressCheckBusy ||
                  !(form.street || "").trim() ||
                  !(form.postalCode || "").trim() ||
                  !(form.city || "").trim()
                }
                className="self-start rounded-[8px] border border-black/10 bg-transparent px-3 py-2 text-xs font-semibold text-[#64748b] hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.1] dark:text-[#8090b0] dark:hover:bg-white/[0.04]"
                style={{
                  cursor:
                    submitting || addressCheckBusy ? "not-allowed" : "pointer",
                }}
              >
                {addressCheckBusy ? "…" : "Adresse prüfen"}
              </button>
            </div>
            <p className="m-0 text-xs text-[#64748b] dark:text-[#6b7a9a]">
              Öffnet Google Maps in einem neuen Tab. Die Adresse wird im Hintergrund geprüft.
            </p>
            {addressCheckHint ? (
              <p className="m-0 text-xs text-[#64748b] dark:text-[#6b7a9a]">
                {addressCheckHint}
              </p>
            ) : null}
          </div>
          <div style={{ marginTop: "12px", marginBottom: "18px" }}>
            <label htmlFor="tc-country" style={labelStyle}>
              Land
            </label>
            <input
              id="tc-country"
              style={inputStyle}
              value={form.country}
              onChange={set("country")}
              autoComplete="country-name"
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
