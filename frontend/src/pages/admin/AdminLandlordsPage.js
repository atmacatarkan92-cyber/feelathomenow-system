import React, { useMemo, useState } from "react";

function getFallbackLandlords() {
  return [
    {
      id: 1,
      company_name: "ABC Immobilien AG",
      contact_person: "Marco Keller",
      email: "marco.keller@abc-immobilien.ch",
      phone: "+41 44 111 22 33",
      city: "Zürich",
      status: "aktiv",
      properties_count: 12,
      units_count: 38,
      last_contact: "2026-03-10",
      notes: "Sehr professionell, offen für Business Apartments.",
    },
    {
      id: 2,
      company_name: "Urban Living Verwaltung GmbH",
      contact_person: "Selin Aydin",
      email: "selin.aydin@urbanliving.ch",
      phone: "+41 61 222 33 44",
      city: "Basel",
      status: "in Verhandlung",
      properties_count: 6,
      units_count: 19,
      last_contact: "2026-03-08",
      notes: "Interesse an Co-Living Konzept gezeigt.",
    },
    {
      id: 3,
      company_name: "Swiss Property Management",
      contact_person: "David Meier",
      email: "d.meier@swisspm.ch",
      phone: "+41 31 555 66 77",
      city: "Bern",
      status: "Lead",
      properties_count: 4,
      units_count: 11,
      last_contact: "2026-02-27",
      notes: "Erstkontakt erfolgt, Follow-up offen.",
    },
    {
      id: 4,
      company_name: "ImmoCenter Schötz",
      contact_person: "Petra Baumann",
      email: "petra.baumann@immocenter.ch",
      phone: "+41 41 777 88 99",
      city: "Schötz",
      status: "aktiv",
      properties_count: 9,
      units_count: 24,
      last_contact: "2026-03-05",
      notes: "Bestehende Zusammenarbeit.",
    },
    {
      id: 5,
      company_name: "Tekirdag Homes",
      contact_person: "Ahmet Demir",
      email: "ahmet.demir@tekirdaghomes.com",
      phone: "+90 532 111 22 33",
      city: "Tekirdag",
      status: "Lead",
      properties_count: 7,
      units_count: 21,
      last_contact: "2026-02-20",
      notes: "Noch keine Verträge, aber interessantes Portfolio.",
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

  if (
    normalized === "inaktiv" ||
    normalized === "inactive" ||
    normalized === "archiv"
  ) {
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

function AdminLandlordsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");

  const landlords = useMemo(() => {
    const saved = localStorage.getItem("fah_landlords");
    return saved ? JSON.parse(saved) : getFallbackLandlords();
  }, []);

  const cityOptions = useMemo(() => {
    const cities = [...new Set(landlords.map((item) => item.city).filter(Boolean))];
    return cities.sort((a, b) => a.localeCompare(b));
  }, [landlords]);

  const filteredLandlords = useMemo(() => {
    let result = [...landlords];

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
          String(item.company_name || "").toLowerCase().includes(term) ||
          String(item.contact_person || "").toLowerCase().includes(term) ||
          String(item.email || "").toLowerCase().includes(term) ||
          String(item.phone || "").toLowerCase().includes(term) ||
          String(item.city || "").toLowerCase().includes(term)
        );
      });
    }

    return result;
  }, [landlords, searchTerm, statusFilter, cityFilter]);

  const summary = useMemo(() => {
    const activeCount = landlords.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      return status === "aktiv" || status === "active";
    }).length;

    const negotiationCount = landlords.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      return (
        status === "in verhandlung" ||
        status === "verhandlung" ||
        status === "negotiation"
      );
    }).length;

    const leadCount = landlords.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      return status === "lead";
    }).length;

    const totalProperties = landlords.reduce(
      (sum, item) => sum + Number(item.properties_count || 0),
      0
    );

    const totalUnits = landlords.reduce(
      (sum, item) => sum + Number(item.units_count || 0),
      0
    );

    return {
      totalCount: landlords.length,
      activeCount,
      negotiationCount,
      leadCount,
      totalProperties,
      totalUnits,
    };
  }, [landlords]);

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
          Verwaltungen
        </h2>

        <p style={{ color: "#64748B", marginTop: "10px" }}>
          Übersicht über Verwaltungen, Ansprechpartner, Städte und bestehende
          Partnerschaften.
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
            Verwaltungen gesamt
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#0F172A" }}>
            {summary.totalCount}
          </div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            Alle erfassten Verwaltungen
          </div>
        </div>

        <div style={getCardStyle("#16A34A")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
            Aktive Partner
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#166534" }}>
            {summary.activeCount}
          </div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            Laufende Zusammenarbeit
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
            Potenzielle Partnerschaften
          </div>
        </div>

        <div style={getCardStyle("#2563EB")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
            Objekte / Units
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#1D4ED8" }}>
            {summary.totalProperties} / {summary.totalUnits}
          </div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            Gesamtbestand über alle Verwaltungen
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
              placeholder="Nach Verwaltung, Ansprechpartner, E-Mail oder Stadt suchen"
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
            Verwaltungsübersicht
          </h3>

          <div style={{ fontSize: "14px", color: "#64748B" }}>
            {filteredLandlords.length} Einträge
          </div>
        </div>

        {filteredLandlords.length === 0 ? (
          <p>Keine Verwaltungen gefunden.</p>
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
                <th style={{ padding: "12px" }}>Verwaltung</th>
                <th style={{ padding: "12px" }}>Ansprechpartner</th>
                <th style={{ padding: "12px" }}>Kontakt</th>
                <th style={{ padding: "12px" }}>Ort</th>
                <th style={{ padding: "12px" }}>Objekte</th>
                <th style={{ padding: "12px" }}>Units</th>
                <th style={{ padding: "12px" }}>Letzter Kontakt</th>
                <th style={{ padding: "12px" }}>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredLandlords.map((item) => {
                const statusMeta = getStatusMeta(item.status);

                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 700, color: "#0F172A" }}>
                        {item.company_name}
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
                      {item.contact_person || "-"}
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
                    <td style={{ padding: "12px" }}>{item.properties_count || 0}</td>
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
        Diese Seite ist bereits so aufgebaut, dass später Airtable-Daten sauber
        in PostgreSQL übernommen und direkt an das CRM-Modul angeschlossen werden
        können.
      </div>
    </div>
  );
}

export default AdminLandlordsPage;
