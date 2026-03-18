import React, { useEffect, useMemo, useState } from "react";
import {
  fetchAdminUnits,
  fetchAdminRooms,
  fetchAdminTenants,
  fetchAdminTenancies,
  fetchAdminInvoices,
  normalizeUnit,
  normalizeRoom,
} from "../../api/adminData";

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `CHF ${amount.toLocaleString("de-CH", {
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

function getStatusMeta(status) {
  const normalized = String(status || "").toLowerCase();

  if (
    normalized === "active" ||
    normalized === "aktiv" ||
    normalized === "belegt"
  ) {
    return {
      label: "Aktiv",
      bg: "#DCFCE7",
      color: "#166534",
      border: "#86EFAC",
    };
  }

  if (
    normalized === "reserved" ||
    normalized === "reserviert"
  ) {
    return {
      label: "Reserviert",
      bg: "#FEF3C7",
      color: "#92400E",
      border: "#FCD34D",
    };
  }

  if (
    normalized === "ended" ||
    normalized === "beendet" ||
    normalized === "move_out" ||
    normalized === "ausgezogen"
  ) {
    return {
      label: "Ausgezogen",
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

function buildTenantRows(tenants, tenancies, rooms, units, invoices) {
  return tenants.map((tenant) => {
    const tenantTenancies = tenancies.filter(
      (tenancy) => String(tenancy.tenant_id) === String(tenant.id)
    );

    const activeTenancy =
      tenantTenancies.find((tenancy) => {
        const status = String(tenancy.status || "").toLowerCase();
        return status === "active" || status === "aktiv";
      }) || tenantTenancies[0];

    const room = activeTenancy
      ? rooms.find((item) => String(item.id) === String(activeTenancy.room_id))
      : null;

    const unit = room
      ? units.find(
          (item) =>
            String(item.id) === String(room.unit_id) ||
            String(item.unitId) === String(room.unit_id)
        )
      : null;

    const tenantInvoices = invoices.filter(
      (invoice) =>
        String(invoice.tenant_id || "") === String(tenant.id) ||
        String(invoice.tenancy_id || "") === String(activeTenancy?.id || "")
    );

    const openInvoices = tenantInvoices.filter((invoice) => {
      const status = String(invoice.status || "").toLowerCase();
      return status === "open" || status === "unpaid" || status === "overdue";
    });

    const paidInvoices = tenantInvoices.filter((invoice) => {
      const status = String(invoice.status || "").toLowerCase();
      return status === "paid";
    });

    const totalOpenAmount = openInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount || 0),
      0
    );

    const totalPaidAmount = paidInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount || 0),
      0
    );

    return {
      id: tenant.id,
      fullName:
        tenant.full_name ||
        tenant.name ||
        `${tenant.first_name || ""} ${tenant.last_name || ""}`.trim() ||
        `Mieter ${tenant.id}`,
      email: tenant.email || "-",
      phone: tenant.phone || tenant.mobile || "-",
      status: activeTenancy?.status || tenant.status || "Offen",
      unitId: unit?.unitId || unit?.unit_id || "-",
      unitAddress: unit?.address || "-",
      roomName: room?.roomName || room?.name || room?.room_number || "-",
      startDate:
        activeTenancy?.move_in_date ||
        activeTenancy?.start_date ||
        tenant.move_in_date ||
        "-",
      endDate:
        activeTenancy?.move_out_date ||
        activeTenancy?.end_date ||
        tenant.move_out_date ||
        "-",
      monthlyRent:
        activeTenancy?.rent_chf ??
        activeTenancy?.monthly_rent ??
        tenant.monthly_rent ??
        0,
      depositAmount:
        activeTenancy?.deposit_chf ??
        activeTenancy?.deposit_amount ??
        tenant.deposit_amount ??
        0,
      billingCycle: activeTenancy?.billing_cycle || "-",
      openInvoicesCount: openInvoices.length,
      paidInvoicesCount: paidInvoices.length,
      totalOpenAmount,
      totalPaidAmount,
      notes: activeTenancy?.notes || tenant.notes || "",
    };
  });
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

function AdminTenantsPage() {
  const [units, setUnits] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [tenancies, setTenancies] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    setLoadError(null);
    Promise.all([
      fetchAdminUnits(),
      fetchAdminRooms(),
      fetchAdminTenants(),
      fetchAdminTenancies(),
      fetchAdminInvoices(),
    ])
      .then(([unitsData, roomsData, tenantsData, tenanciesData, invoicesData]) => {
        setUnits(unitsData.map(normalizeUnit));
        setRooms(roomsData.map(normalizeRoom));
        setTenants(tenantsData);
        setTenancies(tenanciesData);
        setInvoices(invoicesData);
      })
      .catch((e) => {
        setLoadError(e?.message ?? "Fehler beim Laden.");
      })
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    return buildTenantRows(tenants, tenancies, rooms, units, invoices);
  }, [tenants, tenancies, rooms, units, invoices]);

  const summary = useMemo(() => {
    const activeCount = rows.filter((row) => {
      const status = String(row.status || "").toLowerCase();
      return status === "active" || status === "aktiv" || status === "belegt";
    }).length;

    const reservedCount = rows.filter((row) => {
      const status = String(row.status || "").toLowerCase();
      return status === "reserviert" || status === "reserved";
    }).length;

    const movedOutCount = rows.filter((row) => {
      const status = String(row.status || "").toLowerCase();
      return (
        status === "ended" ||
        status === "beendet" ||
        status === "ausgezogen"
      );
    }).length;

    const totalMonthlyRent = rows.reduce(
      (sum, row) => sum + Number(row.monthlyRent || 0),
      0
    );

    const totalOpenInvoices = rows.reduce(
      (sum, row) => sum + Number(row.openInvoicesCount || 0),
      0
    );

    const totalOpenAmount = rows.reduce(
      (sum, row) => sum + Number(row.totalOpenAmount || 0),
      0
    );

    return {
      totalCount: rows.length,
      activeCount,
      reservedCount,
      movedOutCount,
      totalMonthlyRent,
      totalOpenInvoices,
      totalOpenAmount,
    };
  }, [rows]);

  if (loading) {
    return (
      <div style={{ padding: "24px", color: "#64748B" }}>
        Lade Mieter, Zimmer, Mietverhältnisse und Rechnungen …
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        style={{
          padding: "24px",
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: "12px",
          color: "#B91C1C",
        }}
      >
        <strong>Fehler beim Laden:</strong> {loadError}
      </div>
    );
  }

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
          Mieter
        </h2>

        <p style={{ color: "#64748B", marginTop: "10px" }}>
          Übersicht über Mieter, Zimmer, Mietverhältnisse und verknüpfte
          Rechnungen.
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
            Mieter gesamt
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#0F172A" }}>
            {summary.totalCount}
          </div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            Alle erfassten Mieter
          </div>
        </div>

        <div style={getCardStyle("#16A34A")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
            Aktive Mieter
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#166534" }}>
            {summary.activeCount}
          </div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            Aktuell laufende Mietverhältnisse
          </div>
        </div>

        <div style={getCardStyle("#F59E0B")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
            Reserviert
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#92400E" }}>
            {summary.reservedCount}
          </div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            Einzug geplant
          </div>
        </div>

        <div style={getCardStyle("#DC2626")}>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "8px" }}>
            Offene Rechnungen
          </div>
          <div style={{ fontSize: "34px", fontWeight: 800, color: "#991B1B" }}>
            {summary.totalOpenInvoices}
          </div>
          <div style={{ marginTop: "8px", color: "#64748B", fontSize: "14px" }}>
            {formatCurrency(summary.totalOpenAmount)}
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
            Mieterübersicht
          </h3>

          <div style={{ fontSize: "14px", color: "#64748B" }}>
            {rows.length} Einträge
          </div>
        </div>

        {rows.length === 0 ? (
          <p>Keine Mieter gefunden.</p>
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
                <th style={{ padding: "12px" }}>Mieter</th>
                <th style={{ padding: "12px" }}>Kontakt</th>
                <th style={{ padding: "12px" }}>Unit</th>
                <th style={{ padding: "12px" }}>Zimmer</th>
                <th style={{ padding: "12px" }}>Start</th>
                <th style={{ padding: "12px" }}>Ende</th>
                <th style={{ padding: "12px" }}>Monatsmiete</th>
                <th style={{ padding: "12px" }}>Rechnungen offen</th>
                <th style={{ padding: "12px" }}>Offener Betrag</th>
                <th style={{ padding: "12px" }}>Status</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const statusMeta = getStatusMeta(row.status);

                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 700, color: "#0F172A" }}>
                        {row.fullName}
                      </div>
                      {row.notes ? (
                        <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                          {row.notes}
                        </div>
                      ) : null}
                    </td>

                    <td style={{ padding: "12px" }}>
                      <div>{row.email}</div>
                      <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                        {row.phone}
                      </div>
                    </td>

                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 600 }}>{row.unitId}</div>
                      <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                        {row.unitAddress}
                      </div>
                    </td>

                    <td style={{ padding: "12px" }}>{row.roomName}</td>
                    <td style={{ padding: "12px" }}>{formatDate(row.startDate)}</td>
                    <td style={{ padding: "12px" }}>{formatDate(row.endDate)}</td>
                    <td style={{ padding: "12px", fontWeight: 700 }}>
                      {formatCurrency(row.monthlyRent)}
                    </td>
                    <td style={{ padding: "12px" }}>{row.openInvoicesCount}</td>
                    <td style={{ padding: "12px", fontWeight: 700 }}>
                      {formatCurrency(row.totalOpenAmount)}
                    </td>
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
          background: "#ECFDF5",
          border: "1px solid #A7F3D0",
          borderRadius: "18px",
          padding: "18px 20px",
          color: "#065F46",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        Mieter, Zimmer, Mietverhältnisse und Rechnungen werden aus der Backend-API geladen.
      </div>
    </div>
  );
}

export default AdminTenantsPage;
