import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { API_BASE_URL } from "../config";

const cardStyle = {
  maxWidth: "420px",
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

function isValidPasswordLength(pw) {
  return String(pw || "").length >= 8;
}

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("token");
  }, [location.search]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    // Clear messages when token changes.
    setError("");
    setSuccess("");
  }, [token]);

  const canSubmit = Boolean(token) && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setError("This reset link is invalid.");
      return;
    }

    setError("");
    setSuccess("");

    if (!newPassword || !isValidPasswordLength(newPassword)) {
      setError("Validation error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Validation error");
      return;
    }

    setSubmitting(true);
    try {
      // Do not log token/password.
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const detail = payload?.detail ? String(payload.detail) : "";

        if (detail.includes("Invalid or expired token")) {
          setError("This reset link is invalid or has expired.");
        } else if (detail.includes("Password does not meet requirements")) {
          setError("Password does not meet requirements");
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }

      setSuccess("Your password has been reset successfully.");
      // Clear password fields immediately after success.
      setNewPassword("");
      setConfirmPassword("");

      // Optional auto-redirect to admin login (minimal and consistent with existing routes).
      setTimeout(() => {
        try {
          navigate("/admin/login");
        } catch {
          // ignore navigation errors
        }
      }, 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "24px" }}>
      <div style={cardStyle}>
        <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 8px 0", color: "#0F172A" }}>
          Reset Password
        </h2>
        <p style={{ color: "#64748B", margin: "0 0 24px 0", fontSize: "14px" }}>
          {token
            ? "Choose a new password for your account."
            : "This reset link is invalid."}
        </p>

        {error && <p style={{ color: "#B91C1C", margin: 0, fontSize: "14px" }}>{error}</p>}
        {success && <p style={{ color: "#166534", margin: "0 0 12px 0", fontSize: "14px" }}>{success}</p>}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px", marginTop: "8px" }}>
          <div>
            <label style={labelStyle}>New password *</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
              required
              disabled={!token}
            />
          </div>

          <div>
            <label style={labelStyle}>Confirm new password *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
              required
              disabled={!token}
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              padding: "12px 20px",
              background: "#0F172A",
              color: "#FFF",
              border: "none",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "14px",
              cursor: !canSubmit ? "not-allowed" : "pointer",
              opacity: !canSubmit ? 0.7 : 1,
            }}
          >
            {submitting ? "Resetting …" : "Reset Password"}
          </button>
        </form>

        {success && (
          <div style={{ marginTop: "14px", color: "#475569", fontSize: "14px" }}>
            <Link to="/admin/login" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 700 }}>
              Go to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

