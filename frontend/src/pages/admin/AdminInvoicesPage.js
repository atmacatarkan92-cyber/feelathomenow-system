import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { API_BASE_URL, getApiHeaders } from "../../config";

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

function normalizeStatus(status) {
  return String(status || "").toLowerCase().trim();
}

function getStatusMeta(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "paid") {
    return {
      label: "Bezahlt",
      bg: "#DCFCE7",
      color: "#166534",
      border: "#86EFAC",
    };
  }

  if (normalized === "overdue") {
    return {
      label: "Überfällig",
      bg: "#FEE2E2",
      color: "#991B1B",
      border: "#FCA5A5",
    };
  }

  if (normalized === "cancelled") {
    return {
      label: "Storniert",
      bg: "#E5E7EB",
      color: "#374151",
      border: "#D1D5DB",
    };
  }

  return {
    label: "Offen",
    bg: "#FEF3C7",
    color: "#92400E",
    border: "#FCD34D",
  };
}

function isOpenStatus(status) {
  const n = normalizeStatus(status);
  return n === "open" || n === "unpaid";
}

function SummaryCard({ title, count, amount, accentColor }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderTop: `4px solid ${accentColor}`,
        borderRadius: "18px",
        padding: "20px",
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
        {title}
      </div>
      <div
        style={{
          fontSize: "34px",
          fontWeight: 800,
          color: "#0F172A",
          lineHeight: 1.1,
        }}
      >
        {count}
      </div>
      <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
        {formatCurrency(amount)}
      </div>
    </div>
  );
}

function AdminInvoicesPage() {
  const location = useLocation();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingPaidId, setMarkingPaidId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("due_date_desc");

  const now = new Date();
  const [generateYear, setGenerateYear] = useState(now.getFullYear());
  const [generateMonth, setGenerateMonth] = useState(now.getMonth() + 1);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState(null);

  const loadInvoices = () => {
    return fetch(`${API_BASE_URL}/api/invoices`, { headers: getApiHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Fehler beim Laden der Rechnungen");
        return res.json();
      })
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error(err);
        setError("Rechnungen konnten nicht geladen werden.");
      });
  };

  const handleGenerateInvoices = async () => {
    setGenerateMessage(null);
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/invoices/generate`, {
        method: "POST",
        headers: { ...getApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ year: generateYear, month: generateMonth }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Generierung fehlgeschlagen.");
      }
      const created = data.created_count ?? 0;
      const skipped = data.skipped_count ?? 0;
      setGenerateMessage(
        `${created} Rechnung(en) erstellt, ${skipped} übersprungen (bereits vorhanden).`
      );
      await loadInvoices();
    } catch (err) {
      setGenerateMessage(err.message || "Fehler beim Generieren.");
    } finally {
      setGenerating(false);
    }
  };

  const markAsPaid = async (invoiceId) => {
    setMarkingPaidId(invoiceId);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/invoices/${invoiceId}/mark-paid`,
        {
          method: "PATCH",
          headers: { ...getApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) throw new Error("Konnte nicht als bezahlt markiert werden.");
      const updated = await res.json();
      setInvoices((prev) =>
        prev.map((inv) => (String(inv.id) === String(invoiceId) ? updated : inv))
      );
    } catch (err) {
      console.error(err);
      alert(err.message || "Fehler beim Markieren.");
    } finally {
      setMarkingPaidId(null);
    }
  };

  useEffect(() => {
    if (location.pathname.endsWith("/open")) {
      setStatusFilter("open");
      return;
    }

    if (location.pathname.endsWith("/paid")) {
      setStatusFilter("paid");
      return;
    }

    if (location.pathname.endsWith("/overdue")) {
      setStatusFilter("overdue");
      return;
    }

    setStatusFilter("all");
  }, [location.pathname]);

  useEffect(() => {
    loadInvoices().finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const openInvoices = invoices.filter((inv) => isOpenStatus(inv.status));
    const paidInvoices = invoices.filter(
      (inv) => normalizeStatus(inv.status) === "paid"
    );
    const overdueInvoices = invoices.filter(
      (inv) => normalizeStatus(inv.status) === "overdue"
    );
    const cancelledInvoices = invoices.filter(
      (inv) => normalizeStatus(inv.status) === "cancelled"
    );

    const openAmount = openInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0
    );
    const paidAmount = paidInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0
    );
    const overdueAmount = overdueInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0
    );
    const cancelledAmount = cancelledInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0
    );
    const totalAmount = invoices.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0
    );

    return {
      totalCount: invoices.length,
      totalAmount,
      openCount: openInvoices.length,
      openAmount,
      paidCount: paidInvoices.length,
      paidAmount,
      overdueCount: overdueInvoices.length,
      overdueAmount,
      cancelledCount: cancelledInvoices.length,
      cancelledAmount,
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    let result = [...invoices];

    if (statusFilter !== "all") {
      result = result.filter((inv) => {
        const s = normalizeStatus(inv.status);
        if (statusFilter === "open") return isOpenStatus(inv.status);
        return s === statusFilter;
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();

      result = result.filter((inv) => {
        return (
          String(inv.id || "").toLowerCase().includes(term) ||
          String(inv.invoice_number || "").toLowerCase().includes(term) ||
          String(inv.status || "").toLowerCase().includes(term) ||
          String(inv.currency || "").toLowerCase().includes(term)
        );
      });
    }

    result.sort((a, b) => {
      if (sortBy === "amount_desc") {
        return Number(b.amount || 0) - Number(a.amount || 0);
      }

      if (sortBy === "amount_asc") {
        return Number(a.amount || 0) - Number(b.amount || 0);
      }

      if (sortBy === "invoice_number_asc") {
        return String(a.invoice_number || "").localeCompare(
          String(b.invoice_number || "")
        );
      }

      if (sortBy === "invoice_number_desc") {
        return String(b.invoice_number || "").localeCompare(
          String(a.invoice_number || "")
        );
      }

      if (sortBy === "issue_date_asc") {
        return new Date(a.issue_date || 0) - new Date(b.issue_date || 0);
      }

      if (sortBy === "issue_date_desc") {
        return new Date(b.issue_date || 0) - new Date(a.issue_date || 0);
      }

      if (sortBy === "due_date_asc") {
        return new Date(a.due_date || 0) - new Date(b.due_date || 0);
      }

      return new Date(b.due_date || 0) - new Date(a.due_date || 0);
    });

    return result;
  }, [invoices, searchTerm, statusFilter, sortBy]);

  const pageTitle = useMemo(() => {
    if (statusFilter === "open") return "Offene Rechnungen";
    if (statusFilter === "paid") return "Bezahlte Rechnungen";
    if (statusFilter === "overdue") return "Überfällige Rechnungen";
    return "Rechnungen";
  }, [statusFilter]);

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
          FeelAtHomeNow Admin
        </div>

        <h2 style={{ fontSize: "36px", fontWeight: 800, margin: 0 }}>
          {pageTitle}
        </h2>

        <p style={{ color: "#64748B", marginTop: "10px" }}>
          Übersicht über offene, bezahlte, überfällige und stornierte Rechnungen.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <SummaryCard
          title="Total Rechnungen"
          count={summary.totalCount}
          amount={summary.totalAmount}
          accentColor="#CBD5E1"
        />

        <SummaryCard
          title="Offen"
          count={summary.openCount}
          amount={summary.openAmount}
          accentColor="#F59E0B"
        />

        <SummaryCard
          title="Bezahlt"
          count={summary.paidCount}
          amount={summary.paidAmount}
          accentColor="#22C55E"
        />

        <SummaryCard
          title="Überfällig"
          count={summary.overdueCount}
          amount={summary.overdueAmount}
          accentColor="#EF4444"
        />
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "18px",
          padding: "20px",
          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
        }}
      >
        <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 16px 0" }}>
          Rechnungen aus Tenancies generieren
        </h3>
        <p style={{ color: "#64748B", marginBottom: "16px", fontSize: "14px" }}>
          Erzeugt für den gewählten Monat je eine Rechnung pro aktiver Tenancy (Miete anteilig bei Ein-/Auszug).
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>
            Jahr
          </label>
          <select
            value={generateYear}
            onChange={(e) => setGenerateYear(Number(e.target.value))}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #D1D5DB",
              fontSize: "14px",
              minWidth: "100px",
            }}
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151", marginLeft: "8px" }}>
            Monat
          </label>
          <select
            value={generateMonth}
            onChange={(e) => setGenerateMonth(Number(e.target.value))}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #D1D5DB",
              fontSize: "14px",
              minWidth: "120px",
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1, 1).toLocaleDateString("de-CH", { month: "long" })}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleGenerateInvoices}
            disabled={generating}
            style={{
              background: "#2563EB",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 16px",
              fontWeight: 600,
              fontSize: "14px",
              cursor: generating ? "wait" : "pointer",
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? "Wird generiert…" : "Rechnungen generieren"}
          </button>
        </div>
        {generateMessage && (
          <p
            style={{
              marginTop: "12px",
              fontSize: "14px",
              color: generateMessage.startsWith("Fehler") ? "#B91C1C" : "#15803D",
              fontWeight: 500,
            }}
          >
            {generateMessage}
          </p>
        )}
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "18px",
          padding: "20px",
          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr",
            gap: "16px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: "#64748B",
                marginBottom: "8px",
                fontWeight: 600,
              }}
            >
              Suche
            </label>

            <input
              type="text"
              placeholder="Nach Rechnungsnummer, Status oder ID suchen"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                height: "44px",
                borderRadius: "12px",
                border: "1px solid #D1D5DB",
                padding: "0 14px",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: "#64748B",
                marginBottom: "8px",
                fontWeight: 600,
              }}
            >
              Status
            </label>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: "100%",
                height: "44px",
                borderRadius: "12px",
                border: "1px solid #D1D5DB",
                padding: "0 14px",
                fontSize: "14px",
                background: "#fff",
              }}
            >
              <option value="all">Alle Status</option>
              <option value="open">Offen</option>
              <option value="paid">Bezahlt</option>
              <option value="overdue">Überfällig</option>
              <option value="cancelled">Storniert</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: "#64748B",
                marginBottom: "8px",
                fontWeight: 600,
              }}
            >
              Sortierung
            </label>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                width: "100%",
                height: "44px",
                borderRadius: "12px",
                border: "1px solid #D1D5DB",
                padding: "0 14px",
                fontSize: "14px",
                background: "#fff",
              }}
            >
              <option value="due_date_desc">Fälligkeitsdatum absteigend</option>
              <option value="due_date_asc">Fälligkeitsdatum aufsteigend</option>
              <option value="issue_date_desc">Rechnungsdatum absteigend</option>
              <option value="issue_date_asc">Rechnungsdatum aufsteigend</option>
              <option value="amount_desc">Betrag absteigend</option>
              <option value="amount_asc">Betrag aufsteigend</option>
              <option value="invoice_number_asc">Rechnungsnummer A–Z</option>
              <option value="invoice_number_desc">Rechnungsnummer Z–A</option>
            </select>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "18px",
          padding: "20px",
          overflowX: "auto",
          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
            Rechnungsliste
          </h3>

          <div style={{ fontSize: "14px", color: "#64748B" }}>
            {filteredInvoices.length} Einträge
          </div>
        </div>

        {loading && <p>Rechnungen werden geladen...</p>}

        {!loading && error && <p style={{ color: "red" }}>{error}</p>}

        {!loading && !error && filteredInvoices.length === 0 && (
          <p>Keine Rechnungen gefunden.</p>
        )}

        {!loading && !error && filteredInvoices.length > 0 && (
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
                <th style={{ padding: "12px" }}>ID</th>
                <th style={{ padding: "12px" }}>Rechnungsnummer</th>
                <th style={{ padding: "12px" }}>Betrag</th>
                <th style={{ padding: "12px" }}>Währung</th>
                <th style={{ padding: "12px" }}>Status</th>
                <th style={{ padding: "12px" }}>Rechnungsdatum</th>
                <th style={{ padding: "12px" }}>Fälligkeitsdatum</th>
                <th style={{ padding: "12px" }}>Bezahlt am</th>
                <th style={{ padding: "12px" }}>Aktion</th>
              </tr>
            </thead>

            <tbody>
              {filteredInvoices.map((invoice) => {
                const statusMeta = getStatusMeta(invoice.status);
                const isPaid = normalizeStatus(invoice.status) === "paid";
                const marking = markingPaidId === invoice.id;

                return (
                  <tr
                    key={invoice.id}
                    style={{ borderBottom: "1px solid #F1F5F9" }}
                  >
                    <td
                      style={{
                        padding: "12px",
                        color: "#0F172A",
                        fontWeight: 600,
                      }}
                    >
                      {invoice.id}
                    </td>

                    <td
                      style={{
                        padding: "12px",
                        color: "#0F172A",
                        fontWeight: 600,
                      }}
                    >
                      <Link
                        to={`/admin/invoices/${invoice.id}`}
                        style={{
                          color: "#2563EB",
                          textDecoration: "none",
                          fontWeight: 700,
                        }}
                      >
                        {invoice.invoice_number}
                      </Link>
                    </td>

                    <td style={{ padding: "12px" }}>
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </td>

                    <td style={{ padding: "12px" }}>{invoice.currency}</td>

                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          background: statusMeta.bg,
                          color: statusMeta.color,
                          border: `1px solid ${statusMeta.border}`,
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                    </td>

                    <td style={{ padding: "12px" }}>
                      {formatDate(invoice.issue_date)}
                    </td>

                    <td style={{ padding: "12px" }}>
                      {formatDate(invoice.due_date)}
                    </td>

                    <td style={{ padding: "12px" }}>
                      {invoice.paid_at
                        ? formatDate(invoice.paid_at)
                        : "–"}
                    </td>

                    <td style={{ padding: "12px" }}>
                      {!isPaid && (
                        <button
                          type="button"
                          onClick={() => markAsPaid(invoice.id)}
                          disabled={marking}
                          style={{
                            background: "#16A34A",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            padding: "8px 12px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: marking ? "wait" : "pointer",
                            opacity: marking ? 0.7 : 1,
                          }}
                        >
                          {marking ? "…" : "Als bezahlt markieren"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminInvoicesPage;