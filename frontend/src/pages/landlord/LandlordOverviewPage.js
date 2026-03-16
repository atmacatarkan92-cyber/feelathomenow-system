import React, { useEffect, useState } from "react";
import {
  fetchLandlordMe,
  fetchLandlordProperties,
  fetchLandlordUnits,
  fetchLandlordTenancies,
  fetchLandlordInvoices,
} from "../../api/landlordApi";

function LandlordOverviewPage() {
  const [profile, setProfile] = useState(null);
  const [counts, setCounts] = useState({ properties: 0, units: 0, tenancies: 0, invoices: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetchLandlordMe(),
      fetchLandlordProperties(),
      fetchLandlordUnits(),
      fetchLandlordTenancies(),
      fetchLandlordInvoices(),
    ])
      .then(([me, properties, units, tenancies, invoices]) => {
        setProfile(me);
        setCounts({
          properties: Array.isArray(properties) ? properties.length : 0,
          units: Array.isArray(units) ? units.length : 0,
          tenancies: Array.isArray(tenancies) ? tenancies.length : 0,
          invoices: Array.isArray(invoices) ? invoices.length : 0,
        });
      })
      .catch((e) => setError(e.message || "Daten konnten nicht geladen werden."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "#64748B" }}>Lade …</p>;
  if (error) return <p style={{ color: "#B91C1C" }}>{error}</p>;
  if (!profile) return null;

  return (
    <div>
      <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 16px 0", color: "#0F172A" }}>
        Mein Bereich
      </h2>
      <div
        style={{
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px 0", color: "#475569" }}>
          Profil
        </h3>
        <p style={{ margin: "4px 0", color: "#0F172A" }}><strong>Name:</strong> {profile.full_name || profile.contact_name || "—"}</p>
        <p style={{ margin: "4px 0", color: "#0F172A" }}><strong>E-Mail:</strong> {profile.email || "—"}</p>
        <p style={{ margin: "4px 0", color: "#0F172A" }}><strong>Firma:</strong> {profile.company_name || "—"}</p>
        <p style={{ margin: "4px 0", color: "#0F172A" }}><strong>Telefon:</strong> {profile.phone || "—"}</p>
      </div>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {[
          { label: "Properties", value: counts.properties },
          { label: "Units", value: counts.units },
          { label: "Mietverhältnisse", value: counts.tenancies },
          { label: "Rechnungen", value: counts.invoices },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              padding: "16px 20px",
              background: "#FFF",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              minWidth: "140px",
            }}
          >
            <p style={{ margin: 0, fontSize: "14px", color: "#64748B" }}>{label}</p>
            <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: 800, color: "#0F172A" }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LandlordOverviewPage;
