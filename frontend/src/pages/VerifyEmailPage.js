import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { resendVerificationEmail, verifyEmail } from "../api/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";

const ACCENT = "#F97316";
const PAGE = "max-w-7xl mx-auto px-6 lg:px-20";

const MSG_LOADING = "E-Mail wird bestätigt...";
const MSG_SUCCESS = "Deine E-Mail wurde erfolgreich bestätigt.";
const MSG_ERROR = "Der Bestätigungslink ist ungültig oder abgelaufen.";
const MSG_RESEND_OK =
  "Falls das Konto existiert, wurde eine neue Bestätigungsmail versendet.";

export default function VerifyEmailPage() {
  const location = useLocation();
  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("token");
  }, [location.search]);

  const [phase, setPhase] = useState(() => (token ? "loading" : "error"));

  useEffect(() => {
    if (!token) {
      setPhase("error");
      return undefined;
    }
    let cancelled = false;
    setPhase("loading");
    verifyEmail(token)
      .then(() => {
        if (!cancelled) setPhase("success");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resendErr, setResendErr] = useState("");

  const handleResend = (e) => {
    e.preventDefault();
    const em = email.trim();
    if (!em) return;
    setResending(true);
    setResendErr("");
    setResendMsg("");
    resendVerificationEmail(em)
      .then(() => setResendMsg(MSG_RESEND_OK))
      .catch((err) => setResendErr(err.message || "Senden fehlgeschlagen."))
      .finally(() => setResending(false));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div
        className="pointer-events-none absolute right-0 top-20 h-72 w-72 rounded-full bg-orange-500/[0.1] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-32 left-0 h-64 w-64 rounded-full bg-slate-400/[0.1] blur-3xl"
        aria-hidden
      />
      <section className="relative z-10 border-b border-slate-100 bg-gradient-to-b from-slate-50 via-white to-slate-100/30 pt-28 pb-12 lg:pt-32 lg:pb-16">
        <div className={PAGE}>
          <div className="mx-auto max-w-lg text-center">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              E-Mail bestätigen
            </h1>
            <p className="mt-4 text-lg text-slate-500">
              {phase === "loading" && "Wir bestätigen deine E-Mail-Adresse."}
              {phase === "success" && "Du kannst dich jetzt anmelden."}
              {phase === "error" &&
                "Bitte gib bei Bedarf deine E-Mail-Adresse ein, um einen neuen Link anzufordern."}
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-slate-100 bg-gradient-to-b from-white via-slate-50/40 to-white py-24 lg:py-32">
        <div className={PAGE}>
          <Card className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <CardContent className="p-8 text-center">
              {phase === "loading" && (
                <p className="text-slate-600" aria-live="polite">
                  {MSG_LOADING}
                </p>
              )}

              {phase === "success" && (
                <div className="space-y-6">
                  <p className="text-sm font-medium text-emerald-700">{MSG_SUCCESS}</p>
                  <Button
                    asChild
                    className="w-full rounded-full font-semibold text-white shadow-sm"
                    style={{ backgroundColor: ACCENT }}
                  >
                    <Link to="/admin/login">Zum Login</Link>
                  </Button>
                </div>
              )}

              {phase === "error" && (
                <div className="space-y-6 text-left">
                  <p className="text-center text-sm text-red-600">{MSG_ERROR}</p>
                  <form onSubmit={handleResend} className="space-y-4">
                    <div>
                      <label htmlFor="verify-resend-email" className="mb-2 block text-sm font-medium text-slate-700">
                        E-Mail-Adresse
                      </label>
                      <Input
                        id="verify-resend-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@beispiel.de"
                        className="border-slate-200"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={resending || !email.trim()}
                      className="w-full rounded-full font-semibold text-white shadow-sm disabled:opacity-70"
                      style={{ backgroundColor: ACCENT }}
                    >
                      {resending ? "Wird gesendet…" : "E-Mail erneut senden"}
                    </Button>
                  </form>
                  {resendMsg && (
                    <p className="text-center text-sm font-medium text-emerald-700">{resendMsg}</p>
                  )}
                  {resendErr && <p className="text-center text-sm text-red-600">{resendErr}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
