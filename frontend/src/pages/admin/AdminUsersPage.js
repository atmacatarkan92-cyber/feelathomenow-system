import React, { useState } from "react";
import { API_BASE_URL, getApiHeaders } from "../../config";

const inputBaseClass =
  "w-full rounded-[8px] border px-3 py-2.5 text-sm text-[#0f172a] box-border bg-slate-100 dark:bg-[#111520] dark:text-[#eef2ff]";
const inputBorderOk = "border-black/10 dark:border-white/[0.08]";
const inputBorderErr = "border-red-500/60";

const labelClass = "mb-1.5 block text-[10px] font-medium text-[#64748b] dark:text-[#6b7a9a]";

const fieldErrorStyle = {
  color: "#f87171",
  fontSize: "12px",
  marginTop: "4px",
  marginBottom: 0,
  lineHeight: 1.35,
};

const cardClass =
  "rounded-[14px] border border-black/10 dark:border-white/[0.07] bg-white dark:bg-[#141824] p-6";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function inputClassWithError(hasError) {
  return `${inputBaseClass} ${hasError ? inputBorderErr : inputBorderOk}`;
}

export default function AdminUsersPage() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "",
    name: "",
  });

  const [errors, setErrors] = useState({ email: "", password: "", role: "", name: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validateFields = () => {
    const next = { email: "", password: "", role: "", name: "" };
    const emailTrim = form.email.trim();
    if (!emailTrim || !isValidEmail(emailTrim)) {
      next.email = "Bitte gültige E-Mail eingeben";
    }
    if (!form.password || form.password.length < 8) {
      next.password = "Passwort muss mindestens 8 Zeichen lang sein";
    }
    if (!form.role) {
      next.role = "Bitte Rolle auswählen";
    }
    if (!form.name.trim()) {
      next.name = "Bitte Namen eingeben";
    }
    setErrors(next);
    return !next.email && !next.password && !next.role && !next.name;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setError("");
    setSuccess("");

    if (!validateFields()) {
      return;
    }

    const email = form.email.trim();
    const password = form.password;
    const role = form.role;
    const name = form.name.trim();

    const payload = {
      email,
      password,
      role,
      name,
    };

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify(payload),
      });

      // Avoid logging password or payload.
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        if (res.status === 401) setError("Sitzung abgelaufen");
        else if (res.status === 403) setError("Keine Berechtigung");
        else if (res.status === 409) setError("User existiert bereits");
        else if (res.status === 422) setError("Validierungsfehler");
        else setError("Etwas ist schiefgelaufen");
        return;
      }

      setSuccess("User wurde erfolgreich erstellt");
      setForm({ email: "", password: "", role: "", name: "" });
      setErrors({ email: "", password: "", role: "", name: "" });
    } catch (e2) {
      setError("Etwas ist schiefgelaufen");
    } finally {
      // Do not keep passwords in component state longer than needed.
      setForm((f) => ({ ...f, password: "" }));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] px-2 text-[#0f172a] [color-scheme:light] dark:bg-[#07090f] dark:text-[#eef2ff] dark:[color-scheme:dark]">
      <h2 className="mb-4 text-[22px] font-bold">Benutzer / Benutzerverwaltung</h2>

      {error && (
        <p className="mb-3 text-[14px] text-[#f87171]">{error}</p>
      )}
      {success && (
        <p className="mb-3 text-[14px] text-[#4ade80]">{success}</p>
      )}

      <div className={cardClass}>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px" }}>
          <div>
            <label className={labelClass}>E-Mail *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, email: v }));
                const t = v.trim();
                if (t && isValidEmail(t)) {
                  setErrors((prev) => ({ ...prev, email: "" }));
                }
              }}
              className={inputClassWithError(!!errors.email)}
              placeholder="name@beispiel.de"
              autoComplete="email"
            />
            {errors.email ? <p style={fieldErrorStyle}>{errors.email}</p> : null}
          </div>

          <div>
            <label className={labelClass}>Passwort *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, password: v }));
                if (v.length >= 8) {
                  setErrors((prev) => ({ ...prev, password: "" }));
                }
              }}
              className={inputClassWithError(!!errors.password)}
              autoComplete="new-password"
            />
            {errors.password ? <p style={fieldErrorStyle}>{errors.password}</p> : null}
          </div>

          <div>
            <label className={labelClass}>Rolle *</label>
            <select
              value={form.role}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, role: v }));
                if (v) {
                  setErrors((prev) => ({ ...prev, role: "" }));
                }
              }}
              className={inputClassWithError(!!errors.role)}
            >
              <option value="" disabled>
                Rolle auswählen
              </option>
              <option value="admin">admin</option>
              <option value="landlord">landlord</option>
              <option value="tenant">tenant</option>
            </select>
            {errors.role ? <p style={fieldErrorStyle}>{errors.role}</p> : null}
          </div>

          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, name: v }));
                if (v.trim()) {
                  setErrors((prev) => ({ ...prev, name: "" }));
                }
              }}
              className={inputClassWithError(!!errors.name)}
              placeholder="Anzeigename"
              autoComplete="name"
              required
            />
            {errors.name ? <p style={fieldErrorStyle}>{errors.name}</p> : null}
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-[8px] border-none bg-gradient-to-r from-[#5b8cff] to-[#7c5cfc] px-4 py-2.5 font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Wird erstellt …" : "User erstellen"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setError("");
                setSuccess("");
                setErrors({ email: "", password: "", role: "", name: "" });
                setForm({ email: "", password: "", role: "", name: "" });
              }}
              className="rounded-[8px] border border-black/10 dark:border-white/[0.1] bg-transparent px-4 py-2.5 font-semibold text-[#8090b0] hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Zurücksetzen
            </button>
          </div>
        </form>

        <div className="mt-[18px] rounded-[10px] border border-blue-500/[0.12] bg-blue-500/[0.06] px-4 py-3.5 text-[13px] leading-relaxed text-[#7aaeff]">
          Vom Admin erstellte User sind an die Organisation des aktuell angemeldeten Admins gebunden.
        </div>
      </div>
    </div>
  );
}
