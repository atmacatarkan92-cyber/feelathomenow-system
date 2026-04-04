import React, { useEffect, useState } from "react";
import { resendVerificationEmail } from "../../api/auth";

const MSG_UNVERIFIED =
  "Deine E-Mail-Adresse wurde noch nicht bestätigt. Bitte prüfe dein Postfach oder sende die Bestätigungsmail erneut.";

const MSG_RESEND_OK =
  "Falls das Konto existiert, wurde eine neue Bestätigungsmail versendet.";

const btnStyle = {
  marginTop: "10px",
  padding: "10px 16px",
  background: "#FFFFFF",
  color: "#0F172A",
  border: "1px solid #E5E7EB",
  borderRadius: "10px",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

/**
 * Shown when POST /auth/login returns detail email_not_verified.
 */
export default function LoginEmailVerificationBlock({ email, visible }) {
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (!visible) {
      setSuccess(false);
      setResendError("");
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  const handleResend = (e) => {
    e.preventDefault();
    const em = email.trim();
    if (!em) return;
    setResending(true);
    setResendError("");
    setSuccess(false);
    resendVerificationEmail(em)
      .then(() => setSuccess(true))
      .catch((err) => {
        setSuccess(false);
        setResendError(err.message || "Senden fehlgeschlagen.");
      })
      .finally(() => setResending(false));
  };

  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "10px",
        background: "#FFFBEB",
        border: "1px solid #FDE68A",
        fontSize: "14px",
        color: "#92400E",
        lineHeight: 1.45,
      }}
    >
      <p style={{ margin: 0 }}>{MSG_UNVERIFIED}</p>
      <button
        type="button"
        onClick={handleResend}
        disabled={resending || !email.trim()}
        style={{
          ...btnStyle,
          cursor: resending || !email.trim() ? "not-allowed" : "pointer",
          opacity: resending || !email.trim() ? 0.6 : 1,
        }}
      >
        {resending ? "Wird gesendet…" : "E-Mail erneut senden"}
      </button>
      {success && (
        <p style={{ margin: "10px 0 0 0", color: "#15803D", fontSize: "13px" }}>{MSG_RESEND_OK}</p>
      )}
      {resendError && (
        <p style={{ margin: "8px 0 0 0", color: "#B91C1C", fontSize: "13px" }}>{resendError}</p>
      )}
    </div>
  );
}
