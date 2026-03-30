import React, { useEffect, useMemo, useState } from "react";
import {
  fetchAdminUnits,
  fetchAdminRooms,
  fetchAdminTenanciesAll,
  fetchAdminProfit,
  normalizeUnit,
  normalizeRoom,
} from "../../api/adminData";
import {
  getUnitOccupancyStatus,
  formatOccupancyStatusDe,
  getTodayIsoForOccupancy,
} from "../../utils/unitOccupancyStatus";
import { getDisplayUnitId } from "../../utils/unitDisplayId";

function formatCurrency(value) {
  const n = Number(value);
  const amount = Number.isFinite(n) ? n : 0;
  return `CHF ${amount.toLocaleString("de-CH")}`;
}

function compareBest(a, b) {
  if (b.profit !== a.profit) return b.profit - a.profit;
  return b.revenue - a.revenue;
}

function compareWorst(a, b) {
  if (a.profit !== b.profit) return a.profit - b.profit;
  return a.revenue - b.revenue;
}

/** listIndex aligns labels with AdminApartmentsPage (APT-xxx / CL-xxx). */
function getUnitLabel(unit, listIndex) {
  if (!unit) return "—";

  const city = unit.city ?? unit.place ?? "";

  if (typeof listIndex === "number" && listIndex >= 0 && city) {
    const rid = getDisplayUnitId(unit, listIndex);
    if (rid && rid !== "—") {
      return `${rid} · ${city}`;
    }
  }

  if (unit.unitId && city) {
    return `${unit.unitId} · ${city}`;
  }

  if (unit.address && city) {
    return `${unit.address} · ${city}`;
  }

  if (unit.label) {
    return unit.label;
  }

  if (unit.name) {
    return unit.name;
  }

  return unit.id;
}

function AdminPerformancePage() {
  const [units, setUnits] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenancies, setTenancies] = useState([]);
  const [profitMonth, setProfitMonth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    Promise.all([
      fetchAdminUnits()
        .then((data) => (Array.isArray(data) ? data.map(normalizeUnit) : []))
        .catch(() => []),
      fetchAdminRooms()
        .then((data) => (Array.isArray(data) ? data.map(normalizeRoom) : []))
        .catch(() => []),
      fetchAdminTenanciesAll().catch(() => []),
      fetchAdminProfit({ year, month }).catch(() => null),
    ])
      .then(([u, r, t, profit]) => {
        if (cancelled) return;
        setUnits(u);
        setRooms(r);
        setTenancies(Array.isArray(t) ? t : []);
        setProfitMonth(profit);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const todayIso = getTodayIsoForOccupancy();
    const byUnitId = new Map(
      (profitMonth?.units || []).map((row) => [String(row.unit_id), row])
    );
    const results = units.map((unit, listIndex) => {
      const uid = String(unit.id ?? unit.unitId);
      const prow = byUnitId.get(uid);
      const revenue = prow != null ? Number(prow.revenue) : 0;
      const costs = prow != null ? Number(prow.costs) : 0;
      const profit = prow != null ? Number(prow.profit) : 0;
      const occ = getUnitOccupancyStatus(unit, rooms, tenancies);
      return {
        id: unit.id ?? unit.unitId,
        listIndex,
        unit,
        city: unit.place ?? "—",
        revenue,
        costs,
        profit,
        occupancyLabel: occ != null ? formatOccupancyStatusDe(occ) : "—",
      };
    });

    const sortedBest = [...results].sort(compareBest);
    const sortedWorst = [...results].sort(compareWorst);
    const best = sortedBest[0];
    const worst = sortedWorst[0];

    const totalRevenue = results.reduce((a, b) => a + b.revenue, 0);
    const totalProfit = results.reduce((a, b) => a + b.profit, 0);

    return {
      results,
      best,
      worst,
      totalRevenue,
      totalProfit,
    };
  }, [units, rooms, tenancies, profitMonth]);

  if (loading) {
    return (
      <div style={{ display: "grid", gap: "24px" }}>
        <p style={{ color: "#64748B" }}>Lade Performance…</p>
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
          Vantio
        </div>

        <h2
          style={{
            fontSize: "36px",
            fontWeight: 800,
            margin: 0,
          }}
        >
          Performance
        </h2>

        <p
          style={{
            color: "#64748B",
            marginTop: "10px",
          }}
        >
          Analyse der profitabelsten und schwächsten Units (aktive Mietverhältnisse).
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "16px",
        }}
      >
        <div className="card">
          <h4>Gesamt Umsatz</h4>
          <h2>{formatCurrency(stats.totalRevenue)}</h2>
        </div>

        <div className="card">
          <h4>Gesamt Gewinn</h4>
          <h2>{formatCurrency(stats.totalProfit)}</h2>
        </div>

        <div className="card">
          <h4>Beste Unit</h4>
          <h3>
            {getUnitLabel(stats.best?.unit, stats.best?.listIndex)}
          </h3>
          <p>{formatCurrency(stats.best?.profit)}</p>
        </div>

        <div className="card">
          <h4>Schwächste Unit</h4>
          <h3>
            {getUnitLabel(stats.worst?.unit, stats.worst?.listIndex)}
          </h3>
          <p>{formatCurrency(stats.worst?.profit)}</p>
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "20px",
          border: "1px solid #E5E7EB",
        }}
      >
        <h3>Performance pro Unit</h3>

        <table
          style={{
            width: "100%",
            marginTop: "16px",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
              <th style={{ textAlign: "left", padding: "10px" }}>Unit</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Ort</th>
              <th style={{ textAlign: "left", padding: "10px" }}>
                Belegung
              </th>
              <th style={{ textAlign: "left", padding: "10px" }}>Umsatz</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Kosten</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Gewinn</th>
            </tr>
          </thead>

          <tbody>
            {stats.results.map((row) => (
              <tr
                key={row.unit?.id ?? row.id}
                style={{ borderBottom: "1px solid #F1F5F9" }}
              >
                <td style={{ padding: "10px", fontWeight: 700 }}>
                  {getUnitLabel(row.unit, row.listIndex)}
                </td>

                <td style={{ padding: "10px" }}>{row.city}</td>

                <td style={{ padding: "10px" }}>{row.occupancyLabel}</td>

                <td style={{ padding: "10px" }}>
                  {formatCurrency(row.revenue)}
                </td>

                <td style={{ padding: "10px" }}>
                  {formatCurrency(row.costs)}
                </td>

                <td
                  style={{
                    padding: "10px",
                    fontWeight: 700,
                    color: row.profit >= 0 ? "#16A34A" : "#DC2626",
                  }}
                >
                  {formatCurrency(row.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminPerformancePage;
