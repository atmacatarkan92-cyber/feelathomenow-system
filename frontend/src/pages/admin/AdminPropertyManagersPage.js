import React, { useMemo, useState } from "react";

function getFallbackPropertyManagers() {
  return [
    {
      id: 1,
      salutation: "Herr",
      first_name: "Marco",
      last_name: "Keller",
      email: "marco.keller@abc-immobilien.ch",
      phone: "+41 44 111 22 33",
      management_company: "ABC Immobilien AG",
      city: "Zürich",
      status: "aktiv",
      units_count: 18,
      last_contact: "2026-03-10",
      notes: "Hauptansprechpartner für Zürich.",
    },
    {
      id: 2,
      salutation: "Frau",
      first_name: "Selin",
      last_name: "Aydin",
      email: "selin.aydin@urbanliving.ch",
      phone: "+41 61 222 33 44",
      management_company: "Urban Living Verwaltung GmbH",
      city: "Basel",
      status: "in Verhandlung",
      units_count: 9,
      last_contact: "2026-03-08",
      notes: "Interesse an Co-Living Konzept.",
    },
    {
      id: 3,
      salutation: "Herr",
      first_name: "David",
      last_name: "Meier",
      email: "d.meier@swisspm.ch",
      phone: "+41 31 555 66 77",
      management_company: "Swiss Property Management",
      city: "Bern",
      status: "Lead",
      units_count: 6,
      last_contact: "2026-02-27",
      notes: "Follow-up offen.",
    },
    {
      id: 4,
      salutation: "Frau",
      first_name: "Petra",
      last_name: "Baumann",
      email: "petra.baumann@immocenter.ch",
      phone: "+41 41 777 88 99",
      management_company: "ImmoCenter Schötz",
      city: "Schötz",
      status: "aktiv",
      units_count: 14,
      last_contact: "2026-03-05",
      notes: "Bestehende Zusammenarbeit.",
    },
  ];
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

function getStatusMeta(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "aktiv" || normalized === "active") {
    return {
      label: "Aktiv",
      bg: "#DCFCE7",
      color: "#166534",
      border: "#86EFAC",
    };
  }

  if (
    normalized === "in verhandlung" ||
    normalized === "verhandlung" ||
    normalized === "negotiation"
  ) {
    return {
      label: "In Verhandlung",
      bg: "#FEF3C7",
      color: "#92400E",
      border: "#FCD34D",
    };
  }

  if (normalized === "lead") {
    return {
      label: "Lead",
      bg: "#DBEAFE",
      color: "#1D4ED8",
      border: "#93C5FD",
    };
  }

  if (normalized === "inaktiv" || normalized === "inactive") {
    return {
      label: "Inaktiv",
      bg: "#E5E7EB",
      color: "#374151",
      border: "#D1D5DB",
    };
  }

  return {
    label: status || "Offen",
    bg: "#F1F5F9",
    color: "#475569",
    border: "#CBD5E1",
  };
}

function getCardStyle(accentColor) {
  return {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderTop: `4px solid ${accentColor}`,
    borderRadius: "18px",
    padding: "20px",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
  };
}

function buildRows(propertyManagers) {
  return propertyManagers.map((item) => {
    const fullName = [item.salutation, item.first_name, item.last_name]
      .filter(Boolean)
      .join(" ");

    return {
      ...item,
      fullName,
    };
  });
}

function AdminPropertyManagersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");

  const propertyManagers = useMemo(() => {
    const saved = localStorage.getItem("fah_property_managers");
    return saved ? JSON.parse(saved) : getFallbackPropertyManagers();
  }, []);

  const rows = useMemo(() => buildRows(propertyManagers), [propertyManagers]);

  const cityOptions = useMemo(() => {
    const cities = [...new Set(rows.map((item) => item.city).filter(Boolean))];
    return cities.sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (statusFilter !== "all") {
      result = result.filter(
        (item) => String(item.status || "").toLowerCase() === statusFilter
      );
    }

    if (cityFilter !== "all") {
      result = result.filter(
        (item) => String(item.city || "").toLowerCase() === cityFilter
      );
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();

      result = result.filter((item) => {
        return (
          String(item.fullName || "").toLowerCase().includes(term) ||
          String(item.first_name || "").toLowerCase().includes(term) ||
          String(item.last_name || "").toLowerCase().includes(term) ||
          String(item.email || "").toLowerCase().includes(term) ||
          String(item.phone || "").toLowerCase().includes(term) ||
          String(item.management_company || "").toLowerCase().includes(term) ||
          String(item.city || "").toLowerCase().includes(term)
        );
      });
    }

    return result;
  }, [rows, searchTerm, statusFilter, cityFilter]);

  const summary = useMemo(() => {
    const activeCount = rows.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      return status === "aktiv" || status === "active";
    }).length;

    const negotiationCount = rows.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      return (
        status === "in verhandlung" ||
        status === "verhandlung" ||
        status === "negotiation"
      );
    }).length;

    const leadCount = rows.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      return status === "lead";
    }).length;

    const totalUnits = rows.reduce(
      (sum, item) => sum + Number(item.units_count || 0),
      0
    );

    return {
      totalCount: rows.length,
      activeCount,
      negotiationCount,
      leadCount,
      totalUnits,
    };
  }, [rows]);

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
          Bewirtschafter
        </h2>

        <p style={{ color: "#64748B", marginTop: "10px" }}>
          Übersicht über Bewirtschafter, Ansprechpartner, Städte und zugeordnete
          Units.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <div style={getCardStyle("#334155")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
            Bewirtschafter gesamt
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#0F172A" }}>
            {summary.totalCount}
          </div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            Alle erfassten Kontakte
          </div>
        </div>

        <div style={getCardStyle("#16A34A")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
            Aktiv
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#166534" }}>
            {summary.activeCount}
          </div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            Laufende Kontakte
          </div>
        </div>

        <div style={getCardStyle("#F59E0B")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
            In Verhandlung
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#92400E" }}>
            {summary.negotiationCount}
          </div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            Potenzielle Partner
          </div>
        </div>

        <div style={getCardStyle("#2563EB")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
            Zugeordnete Units
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#1D4ED8" }}>
            {summary.totalUnits}
          </div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            Gesamt über alle Bewirtschafter
          </div>
        </div>
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
              placeholder="Nach Name, Verwaltung, E-Mail, Telefon oder Stadt suchen"
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
              <option value="aktiv">Aktiv</option>
              <option value="in verhandlung">In Verhandlung</option>
              <option value="lead">Lead</option>
              <option value="inaktiv">Inaktiv</option>
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
              Ort
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
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
              <option value="all">Alle Orte</option>
              {cityOptions.map((city) => (
                <option key={city} value={city.toLowerCase()}>
                  {city}
                </option>
              ))}
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
            Bewirtschafterübersicht
          </h3>

          <div style={{ fontSize: "14px", color: "#64748B" }}>
            {filteredRows.length} Einträge
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <p>Keine Bewirtschafter gefunden.</p>
        ) : (
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
                <th style={{ padding: "12px" }}>Bewirtschafter</th>
                <th style={{ padding: "12px" }}>Verwaltung</th>
                <th style={{ padding: "12px" }}>Kontakt</th>
                <th style={{ padding: "12px" }}>Ort</th>
                <th style={{ padding: "12px" }}>Units</th>
                <th style={{ padding: "12px" }}>Letzter Kontakt</th>
                <th style={{ padding: "12px" }}>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((item) => {
                const statusMeta = getStatusMeta(item.status);

                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 700, color: "#0F172A" }}>
                        {item.fullName}
                      </div>
                      {item.notes ? (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748B",
                            marginTop: "4px",
                          }}
                        >
                          {item.notes}
                        </div>
                      ) : null}
                    </td>

                    <td style={{ padding: "12px", fontWeight: 600 }}>
                      {item.management_company || "-"}
                    </td>

                    <td style={{ padding: "12px" }}>
                      <div>{item.email || "-"}</div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748B",
                          marginTop: "4px",
                        }}
                      >
                        {item.phone || "-"}
                      </div>
                    </td>

                    <td style={{ padding: "12px" }}>{item.city || "-"}</td>
                    <td style={{ padding: "12px" }}>{item.units_count || 0}</td>
                    <td style={{ padding: "12px" }}>{formatDate(item.last_contact)}</td>

                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 700,
                          background: statusMeta.bg,
                          color: statusMeta.color,
                          border: `1px solid ${statusMeta.border}`,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div
        style={{
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderRadius: "18px",
          padding: "18px 20px",
          color: "#92400E",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        Diese Seite ist bereits so aufgebaut, dass später die PostgreSQL-Tabelle
        <strong> property_managers </strong> direkt angebunden werden kann.
      </div>
    </div>
  );
}

export default AdminPropertyManagersPage;
