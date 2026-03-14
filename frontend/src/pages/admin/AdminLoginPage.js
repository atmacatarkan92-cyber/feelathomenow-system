import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, ADMIN_TOKEN_KEY } from "../../config";

const cardStyle = {
  maxWidth: "400px",
  margin: "0 auto",
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: "18px",
  padding: "32px",
  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
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

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    })
      .then(async (res) => {
        const text = await res.text();
        if (!res.ok) {
          let message = `Fehler ${res.status}`;
          try {
            const data = JSON.parse(text);
            const detail = data.detail;
            if (detail != null) message = typeof detail === "string" ? detail : String(detail);
          } catch (_) {
            if (text) message = text;
          }
          throw new Error(message);
        }
        return text ? JSON.parse(text) : {};
      })
      .then((data) => {
        const token = data.access_token;
        if (token) {
          localStorage.setItem(ADMIN_TOKEN_KEY, token);
          navigate("/admin/listings", { replace: true });
        } else {
          setError("Kein Token in der Antwort.");
        }
      })
      .catch((err) => {
        setError(err.message || "Anmeldung fehlgeschlagen.");
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <div style={{ padding: "24px" }}>
      <div style={cardStyle}>
        <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 8px 0", color: "#0F172A" }}>
          Admin Anmeldung
        </h2>
        <p style={{ color: "#64748B", margin: "0 0 24px 0", fontSize: "14px" }}>
          E-Mail und Passwort eingeben. Nach erfolgreicher Anmeldung wirst du zu den Listings weitergeleitet.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={labelStyle}>E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@example.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>
          {error && (
            <p style={{ color: "#B91C1C", margin: 0, fontSize: "14px" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "12px 20px",
              background: "#0F172A",
              color: "#FFF",
              border: "none",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "14px",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Wird angemeldet…" : "Anmelden"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLoginPage;
