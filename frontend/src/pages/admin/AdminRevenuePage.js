import React, { useEffect, useMemo, useState } from "react";
import { fetchAdminInvoices } from "../../api/adminData";

function formatCurrency(value, currency = "CHF") {
  const amount = Number(value || 0);

  return `${currency} ${amount.toLocaleString("de-CH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function SummaryCard({ title, value, accent }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderTop: `4px solid ${accent}`,
        borderRadius: "18px",
        padding: "20px",
        boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
        {title}
      </div>

      <div
        style={{
          fontSize: "32px",
          fontWeight: 800,
          color: "#0F172A",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AdminRevenuePage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAdminInvoices()
      .then(setInvoices)
      .catch((err) => {
        console.error(err);
        setError(err?.message ?? "Einnahmen konnten nicht geladen werden");
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "paid");

    const totalRevenue = paid.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0
    );

    const openInvoices = invoices.filter((i) => i.status === "open");

    const expectedRevenue = openInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0
    );

    const overdue = invoices.filter((i) => i.status === "overdue");

    const overdueAmount = overdue.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0
    );

    return {
      totalRevenue,
      expectedRevenue,
      overdueAmount,
      paidCount: paid.length,
    };
  }, [invoices]);

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div>
        <div
          style={{
            fontSize: "12px",
            color: "#f97316",
            fontWeight: 700,
            marginBottom: "8px",
          }}
        >
          Vantio
        </div>

        <h2 style={{ fontSize: "36px", fontWeight: 800, margin: 0 }}>
          Einnahmen
        </h2>

        <p style={{ color: "#64748B", marginTop: "10px" }}>
          Übersicht über bezahlte Rechnungen und erwartete Einnahmen.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "16px",
        }}
      >
        <SummaryCard
          title="Gesamte Einnahmen"
          value={formatCurrency(stats.totalRevenue)}
          accent="#22C55E"
        />

        <SummaryCard
          title="Erwartete Einnahmen"
          value={formatCurrency(stats.expectedRevenue)}
          accent="#F59E0B"
        />

        <SummaryCard
          title="Überfällige Beträge"
          value={formatCurrency(stats.overdueAmount)}
          accent="#EF4444"
        />

        <SummaryCard
          title="Bezahlte Rechnungen"
          value={stats.paidCount}
          accent="#64748B"
        />
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: "18px",
          padding: "24px",
          boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
        }}
      >
        <h3 style={{ fontSize: "22px", fontWeight: 700, marginTop: 0 }}>
          Letzte Einnahmen
        </h3>

        {loading && <p>Daten werden geladen...</p>}

        {error && <p style={{ color: "red" }}>{error}</p>}

        {!loading && !error && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #E5E7EB",
                  color: "#64748B",
                }}
              >
                <th style={{ padding: "12px" }}>Rechnung</th>
                <th style={{ padding: "12px" }}>Datum</th>
                <th style={{ padding: "12px" }}>Betrag</th>
                <th style={{ padding: "12px" }}>Status</th>
              </tr>
            </thead>

            <tbody>
              {invoices.slice(0, 10).map((inv) => (
                <tr
                  key={inv.id}
                  style={{ borderBottom: "1px solid #F1F5F9" }}
                >
                  <td style={{ padding: "12px", fontWeight: 600 }}>
                    {inv.invoice_number}
                  </td>

                  <td style={{ padding: "12px" }}>
                    {formatDate(inv.issue_date)}
                  </td>

                  <td style={{ padding: "12px" }}>
                    {formatCurrency(inv.amount, inv.currency)}
                  </td>

                  <td style={{ padding: "12px" }}>{inv.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminRevenuePage;