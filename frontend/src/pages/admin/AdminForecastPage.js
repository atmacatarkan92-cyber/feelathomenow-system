import React, { useEffect, useMemo, useState } from "react";
import { fetchAdminUnits, fetchAdminRevenueForecast, normalizeUnit } from "../../api/adminData";

function formatCurrencyMaybe(value) {
  if (value === null || value === undefined) return "-";
  return `CHF ${Number(value).toLocaleString("de-CH")}`;
}

function AdminForecastPage() {
  const [units, setUnits] = useState([]);
  const [revenueForecast, setRevenueForecast] = useState(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    fetchAdminUnits()
      .then((data) => setUnits(Array.isArray(data) ? data.map(normalizeUnit) : []))
      .catch(() => setUnits([]));
    fetchAdminRevenueForecast({ year: currentYear, month: currentMonth })
      .then((data) => setRevenueForecast(data))
      .catch(() => setRevenueForecast(null));
  }, [currentYear, currentMonth]);

  const forecast = useMemo(() => {
    const api = revenueForecast;
    if (!api || !api.summary) {
      return { rows: [], totalRevenue: null, totalProfit: null };
    }
    const totalRevenue =
      api.summary.expected_revenue != null
        ? api.summary.expected_revenue
        : null;
    const unitRows = Array.isArray(api.units) ? api.units : [];
    const rows = unitRows.map((rec) => {
      const u = units.find((x) => String(x.id) === String(rec.unit_id));
      return {
        id: u?.unitId || rec.unit_id,
        city: u?.place ?? "-",
        revenue: rec.expected_revenue != null ? rec.expected_revenue : null,
        costs: null,
        profit: null,
        risk: null,
      };
    });
    return {
      rows,
      totalRevenue,
      totalProfit: null,
    };
  }, [units, revenueForecast]);

  return (
    <div style={{display:"grid",gap:"24px"}}>

      <div>
        <div style={{
          fontSize:"12px",
          color:"#f97316",
          fontWeight:700,
          marginBottom:"8px"
        }}>
          FeelAtHomeNow Admin
        </div>

        <h2 style={{
          fontSize:"36px",
          fontWeight:800,
          margin:0
        }}>
          Prognose
        </h2>

        <p style={{
          color:"#64748B",
          marginTop:"10px"
        }}>
          Erwarteter Umsatz und Gewinn für den nächsten Monat.
        </p>
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
        gap:"16px"
      }}>

        <div className="card">
          <h4>Erwarteter Umsatz</h4>
          <h2>{formatCurrencyMaybe(forecast.totalRevenue)}</h2>
        </div>

        <div className="card">
          <h4>Erwarteter Gewinn</h4>
          <h2>{formatCurrencyMaybe(forecast.totalProfit)}</h2>
        </div>

      </div>

      <div style={{
        background:"#fff",
        borderRadius:"16px",
        padding:"20px",
        border:"1px solid #E5E7EB"
      }}>

        <h3>Forecast pro Unit</h3>

        <table style={{
          width:"100%",
          marginTop:"16px",
          borderCollapse:"collapse"
        }}>

          <thead>
            <tr style={{borderBottom:"1px solid #E5E7EB"}}>
              <th style={{textAlign:"left",padding:"10px"}}>Unit</th>
              <th style={{textAlign:"left",padding:"10px"}}>Ort</th>
              <th style={{textAlign:"left",padding:"10px"}}>Umsatz</th>
              <th style={{textAlign:"left",padding:"10px"}}>Kosten</th>
              <th style={{textAlign:"left",padding:"10px"}}>Gewinn</th>
              <th style={{textAlign:"left",padding:"10px"}}>Risiko</th>
            </tr>
          </thead>

          <tbody>

            {forecast.rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "10px", fontWeight: 700 }}>{row.id}</td>
                  <td style={{ padding: "10px" }}>{row.city}</td>
                  <td style={{ padding: "10px" }}>
                    {formatCurrencyMaybe(row.revenue)}
                  </td>
                  <td style={{ padding: "10px" }}>{formatCurrencyMaybe(row.costs)}</td>
                  <td style={{ padding: "10px", fontWeight: 700 }}>
                    {formatCurrencyMaybe(row.profit)}
                  </td>
                  <td style={{ padding: "10px", fontWeight: 700, color: "#64748B" }}>
                    {row.risk ?? "-"}
                  </td>
                </tr>
              ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}

export default AdminForecastPage;
