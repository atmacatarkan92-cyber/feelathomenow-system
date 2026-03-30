import React, { useEffect, useMemo, useState } from "react";
import { fetchAdminUnits, fetchAdminUnitCosts, normalizeUnit } from "../../api/adminData";
import { getUnitCostsTotal } from "../../utils/adminUnitRunningCosts";

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `CHF ${amount.toLocaleString("de-CH")}`;
}

function AdminBreakEvenPage() {
  const [units, setUnits] = useState([]);
  const [unitCostsByUnitId, setUnitCostsByUnitId] = useState({});

  useEffect(() => {
    fetchAdminUnits()
      .then((data) => setUnits(Array.isArray(data) ? data.map(normalizeUnit) : []))
      .catch(() => setUnits([]));
  }, []);

  useEffect(() => {
    if (!Array.isArray(units) || units.length === 0) {
      setUnitCostsByUnitId({});
      return undefined;
    }
    let cancelled = false;
    Promise.all(
      units.map((u) =>
        fetchAdminUnitCosts(u.id)
          .then((rows) => [String(u.id), Array.isArray(rows) ? rows : []])
          .catch(() => [String(u.id), []])
      )
    ).then((entries) => {
      if (cancelled) return;
      setUnitCostsByUnitId(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [units]);

  const rows = useMemo(() => {
    return units.map((unit) => {
      const revenue = Number(unit.tenantPriceMonthly || 0);
      const rowsCosts =
        unitCostsByUnitId[String(unit.id)] ?? unitCostsByUnitId[unit.id] ?? [];
      const costs = getUnitCostsTotal(rowsCosts);

      const breakEvenOccupancy = revenue === 0 ? null : costs / revenue;

      return {
        id: unit.unitId,
        city: unit.place,
        revenue,
        costs,
        breakEvenOccupancy,
      };
    });
  }, [units, unitCostsByUnitId]);

  return (
    <div style={{display:"grid",gap:"24px"}}>

      <div>
        <div style={{
          fontSize:"12px",
          color:"#f97316",
          fontWeight:700,
          marginBottom:"8px"
        }}>
          Vantio
        </div>

        <h2 style={{
          fontSize:"36px",
          fontWeight:800,
          margin:0
        }}>
          Break-Even Analyse
        </h2>

        <p style={{
          color:"#64748B",
          marginTop:"10px"
        }}>
          Zeigt ab welcher Belegung eine Unit profitabel wird.
        </p>
      </div>

      <div style={{
        background:"#fff",
        borderRadius:"16px",
        padding:"20px",
        border:"1px solid #E5E7EB"
      }}>

        <h3>Break-Even pro Unit</h3>

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
              <th style={{textAlign:"left",padding:"10px"}}>Break-Even</th>
            </tr>
          </thead>

          <tbody>

            {rows.map(row => {

              const occ = row.breakEvenOccupancy;
              const pctNum =
                occ != null && Number.isFinite(occ) ? occ * 100 : null;
              const percentStr =
                pctNum != null ? `${pctNum.toFixed(1)} %` : "—";

              return (
                <tr key={row.id} style={{borderBottom:"1px solid #F1F5F9"}}>

                  <td style={{padding:"10px",fontWeight:700}}>
                    {row.id}
                  </td>

                  <td style={{padding:"10px"}}>
                    {row.city}
                  </td>

                  <td style={{padding:"10px"}}>
                    {formatCurrency(row.revenue)}
                  </td>

                  <td style={{padding:"10px"}}>
                    {formatCurrency(row.costs)}
                  </td>

                  <td style={{
                    padding:"10px",
                    fontWeight:700,
                    color:
                      pctNum == null
                        ? "#64748B"
                        : pctNum > 90
                          ? "#DC2626"
                          : "#16A34A"
                  }}>
                    {percentStr}
                  </td>

                </tr>
              );

            })}

          </tbody>

        </table>

      </div>

    </div>
  );
}

export default AdminBreakEvenPage;
