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
    <div
      className="min-h-full bg-[#f8fafc] text-[#0f172a] [color-scheme:light] dark:bg-[#07090f] dark:text-[#eef2ff] dark:[color-scheme:dark]"
      style={{ display: "grid", gap: "24px" }}
    >

      <div>
        <div
          style={{
            fontSize: "12px",
            color: "#fb923c",
            fontWeight: 700,
            marginBottom: "8px",
          }}
        >
          Vantio
        </div>

        <h2
          style={{
            fontSize: "22px",
            fontWeight: 700,
            margin: 0,
          }}
        >
          Break-Even Analyse
        </h2>

        <p
          className="mt-[10px] text-[12px] text-[#64748b] dark:text-[#6b7a9a]"
        >
          Zeigt ab welcher Belegung eine Unit profitabel wird.
        </p>
      </div>

      <div
        className="rounded-[14px] border border-black/10 bg-white p-5 dark:border-white/[0.07] dark:bg-[#141824]"
      >

        <h3
          className="m-0 text-[9px] font-bold uppercase tracking-[1px] text-[#64748b] dark:text-[#6b7a9a]"
        >
          Break-Even pro Unit
        </h3>

        <table
          style={{
            width: "100%",
            marginTop: "16px",
            borderCollapse: "collapse",
          }}
          className="text-[#0f172a] dark:text-[#eef2ff]"
        >

          <thead>
            <tr
              className="bg-slate-100 text-[9px] font-bold uppercase tracking-[0.8px] text-[#64748b] dark:bg-[#111520] dark:text-[#6b7a9a]"
            >
              <th style={{ textAlign: "left", padding: "10px" }}>Unit</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Ort</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Umsatz</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Kosten</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Break-Even</th>
            </tr>
          </thead>

          <tbody>

            {rows.map((row) => {

              const occ = row.breakEvenOccupancy;
              const pctNum =
                occ != null && Number.isFinite(occ) ? occ * 100 : null;
              const percentStr =
                pctNum != null ? `${pctNum.toFixed(1)} %` : "—";

              return (
                <tr
                  key={row.id}
                  className="border-b border-black/10 dark:border-white/[0.05]"
                >

                  <td
                    className="p-[10px] text-[13px] font-bold text-[#0f172a] dark:text-[#eef2ff]"
                  >
                    {row.id}
                  </td>

                  <td className="p-[10px] text-[13px] text-[#0f172a] dark:text-[#eef2ff]">
                    {row.city}
                  </td>

                  <td
                    style={{
                      padding: "10px",
                      color: "#4ade80",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                  >
                    {formatCurrency(row.revenue)}
                  </td>

                  <td className="p-[10px] text-[13px] text-[#0f172a] dark:text-[#eef2ff]">
                    {formatCurrency(row.costs)}
                  </td>

                  <td
                    style={{
                      padding: "10px",
                      fontWeight: 700,
                      fontSize: "13px",
                      color:
                        pctNum == null
                          ? "#64748b"
                          : pctNum > 90
                            ? "#f87171"
                            : "#4ade80",
                    }}
                    className={pctNum == null ? "text-[#64748b] dark:text-[#6b7a9a]" : undefined}
                  >
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
