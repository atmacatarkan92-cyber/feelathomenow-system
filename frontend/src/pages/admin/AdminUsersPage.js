import React, { useState } from "react";
import { API_BASE_URL, getApiHeaders } from "../../config";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #E5E7EB",
  fontSize: "14px",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#374151",
};

const fieldErrorStyle = {
  color: "#B91C1C",
  fontSize: "12px",
  marginTop: "4px",
  marginBottom: 0,
  lineHeight: 1.35,
};

const cardStyle = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: "18px",
  padding: "24px",
  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function inputStyleWithError(hasError) {
  return {
    ...inputStyle,
    borderColor: hasError ? "#DC2626" : "#E5E7EB",
  };
}

export default function AdminUsersPage() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "",
    name: "",
  });

  const [errors, setErrors] = useState({ email: "", password: "", role: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validateFields = () => {
    const next = { email: "", password: "", role: "" };
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
    setErrors(next);
    return !next.email && !next.password && !next.role;
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
    };
    if (name) payload.name = name;

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
        if (res.status === 401) setError("Session expired");
        else if (res.status === 403) setError("Not authorized");
        else if (res.status === 409) setError("User already exists");
        else if (res.status === 422) setError("Validation error");
        else setError("Something went wrong");
        return;
      }

      setSuccess("User created successfully");
      setForm({ email: "", password: "", role: "", name: "" });
      setErrors({ email: "", password: "", role: "" });
    } catch (e2) {
      setError("Something went wrong");
    } finally {
      // Do not keep passwords in component state longer than needed.
      setForm((f) => ({ ...f, password: "" }));
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "0 8px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>
        Users / User Management
      </h2>

      {error && (
        <p style={{ color: "#B91C1C", marginBottom: "12px", fontSize: "14px" }}>
          {error}
        </p>
      )}
      {success && (
        <p style={{ color: "#166534", marginBottom: "12px", fontSize: "14px" }}>
          {success}
        </p>
      )}

      <div style={cardStyle}>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Email *</label>
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
              style={inputStyleWithError(!!errors.email)}
              placeholder="name@example.com"
              autoComplete="email"
            />
            {errors.email ? <p style={fieldErrorStyle}>{errors.email}</p> : null}
          </div>

          <div>
            <label style={labelStyle}>Password *</label>
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
              style={inputStyleWithError(!!errors.password)}
              autoComplete="new-password"
            />
            {errors.password ? <p style={fieldErrorStyle}>{errors.password}</p> : null}
          </div>

          <div>
            <label style={labelStyle}>Role *</label>
            <select
              value={form.role}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, role: v }));
                if (v) {
                  setErrors((prev) => ({ ...prev, role: "" }));
                }
              }}
              style={inputStyleWithError(!!errors.role)}
            >
              <option value="" disabled>
                Select role
              </option>
              <option value="admin">admin</option>
              <option value="landlord">landlord</option>
              <option value="tenant">tenant</option>
            </select>
            {errors.role ? <p style={fieldErrorStyle}>{errors.role}</p> : null}
          </div>

          <div>
            <label style={labelStyle}>Name (optional)</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              style={inputStyle}
              placeholder="Optional display name"
              autoComplete="name"
            />
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "10px 16px",
                background: "#0F172A",
                color: "#FFF",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Creating …" : "Create User"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setError("");
                setSuccess("");
                setErrors({ email: "", password: "", role: "" });
                setForm({ email: "", password: "", role: "", name: "" });
              }}
              style={{
                padding: "10px 16px",
                background: "#F1F5F9",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </form>

        <div
          style={{
            marginTop: "18px",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "14px 16px",
            color: "#475569",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          Admin-created users are bound to the organization of the logged-in admin.
        </div>
      </div>
    </div>
  );
}
