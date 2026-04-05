import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  fetchAdminUnits,
  fetchAdminRooms,
  fetchAdminProperties,
  fetchAdminLandlords,
  fetchAdminPropertyManagers,
  fetchAdminTenanciesAll,
  createAdminUnit,
  updateAdminUnit,
  deleteAdminUnit,
  fetchAdminUnitCosts,
  createAdminUnitCost,
  deleteAdminUnitCost,
  verifyAdminAddress,
  geocodeAdminUnit,
  normalizeUnit,
  normalizeRoom,
} from "../../api/adminData";
import { getDisplayUnitId, normalizeUnitTypeLabel } from "../../utils/unitDisplayId";
import {
  getUnitOccupancyStatus,
  formatOccupancyStatusDe,
  isLandlordContractLeaseStarted,
  sumActiveTenancyMonthlyRentForUnit,
} from "../../utils/unitOccupancyStatus";
import {
  getCoLivingMetrics,
  getRoomsForUnit,
} from "../../utils/adminUnitCoLivingMetrics";
import { getUnitMonthlyRunningCosts } from "../../utils/adminUnitRunningCosts";
import { lookupSwissPlz } from "../../data/swissPlzLookup";
import { SWISS_CANTON_CODES } from "../../constants/swissCantons";
import { buildGoogleMapsSearchUrl } from "../../utils/googleMapsUrl";

function landlordSelectLabel(l) {
  const c = String(l.company_name || "").trim();
  const n = String(l.contact_name || "").trim();
  if (c && n) return `${c} — ${n}`;
  return c || n || String(l.email || "").trim() || l.id;
}

function propertyManagerSelectLabel(pm) {
  const n = String(pm.name || "").trim();
  if (n) return n;
  const e = String(pm.email || "").trim();
  if (e) return e;
  return pm.id;
}

const emptyForm = {
  place: "",
  zip: "",
  address: "",
  canton: "",
  type: "Apartment",
  rooms: "",
  occupiedRooms: 0,
  property_id: "",
  landlord_id: "",
  property_manager_id: "",
  tenantPriceMonthly: "",
  availableFrom: "",
  landlordDepositType: "",
  landlordDepositAmount: "",
  landlordDepositAnnualPremium: "",
  leaseType: "",
  leaseStartDate: "",
  leaseEndDate: "",
  noticeGivenDate: "",
  terminationEffectiveDate: "",
  returnedToLandlordDate: "",
  leaseStatus: "",
  leaseNotes: "",
};

function parseMoneyChf(raw) {
  if (raw === "" || raw == null) return 0;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalMoneyChf(raw) {
  if (raw === "" || raw == null) return null;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function dateOnlyOrNull(raw) {
  const s = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return s.slice(0, 10);
}

function computeLeaseStatusKey(formData) {
  const leaseStart = dateOnlyOrNull(formData?.leaseStartDate);
  const notice = dateOnlyOrNull(formData?.noticeGivenDate);
  const returned = dateOnlyOrNull(formData?.returnedToLandlordDate);
  const today = getTodayDateString();
  if (returned && returned <= today) return "ended";
  if (notice) return "notice_given";
  if (leaseStart) return "active";
  return "";
}

function leaseStatusLabel(key) {
  if (key === "active") return "Aktiv";
  if (key === "notice_given") return "Gekündigt";
  if (key === "ended") return "Beendet";
  return "—";
}

function strOrNull(raw) {
  const t = String(raw ?? "").trim();
  return t === "" ? null : t;
}

/** Geocoding line for unit modal (aligned with Liegenschaften / AdminPropertiesPage). */
function unitGeocodingStatusPresentation(meta, snapshot, isCreate) {
  if (isCreate) {
    return {
      text: "Koordinaten: Noch nicht berechnet",
      className: "text-[11px] text-[#64748b] dark:text-[#6b7a9a]",
    };
  }
  if (meta) {
    if (meta.status === "ok") {
      return {
        text: "Koordinaten: Erfolgreich",
        className: "text-[11px] font-medium text-emerald-600 dark:text-emerald-400",
      };
    }
    if (meta.status === "skipped") {
      if (meta.reason === "unchanged") {
        return {
          text: "Koordinaten: Adresse unverändert",
          className: "text-[11px] text-[#64748b] dark:text-[#6b7a9a]",
        };
      }
      if (meta.reason === "incomplete_address") {
        return {
          text: "Koordinaten: Unvollständig",
          className: "text-[11px] font-medium text-amber-600 dark:text-amber-400/95",
        };
      }
      if (meta.reason === "provider_unavailable") {
        return {
          text: "Koordinaten: Unvollständig",
          className: "text-[11px] font-medium text-amber-700 dark:text-amber-500/90",
        };
      }
      return {
        text: "Koordinaten: Übersprungen",
        className: "text-[11px] text-[#64748b] dark:text-[#6b7a9a]",
      };
    }
    if (meta.status === "failed") {
      return {
        text: "Koordinaten: Fehlgeschlagen",
        className: "text-[11px] font-medium text-red-600 dark:text-red-400/95",
      };
    }
  }
  if (snapshot && snapshot.lat != null && snapshot.lng != null) {
    return {
      text: "Koordinaten: Erfolgreich",
      className: "text-[11px] text-emerald-600/95 dark:text-emerald-400/85",
    };
  }
  return {
    text: "Koordinaten: Noch nicht berechnet",
    className: "text-[11px] text-[#64748b] dark:text-[#6b7a9a]",
  };
}

function numFieldStr(v) {
  if (v == null || v === "") return "";
  return String(v);
}

function formatCurrencyChf2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "CHF —";
  return `CHF ${n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Stable room count from number input (avoids `|| 0` turning "" into 0 incorrectly for parsing). */
function parseRoomsTotal(raw) {
  if (raw === "" || raw === null || raw === undefined) return 0;
  const s = String(raw).replace(/\u00a0/g, " ").trim();
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function parseRoomPriceChf(raw) {
  if (raw === "" || raw === null || raw === undefined) return NaN;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function sumCoLivingRoomPricesChf(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => {
    const p = parseRoomPriceChf(row?.price);
    return sum + (Number.isFinite(p) && p >= 0 ? p : 0);
  }, 0);
}

function sumFirstNCoLivingRoomPricesChf(rows, n) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const cap = Math.min(Math.max(0, Math.floor(Number(n) || 0)), rows.length);
  let sum = 0;
  for (let i = 0; i < cap; i++) {
    const p = parseRoomPriceChf(rows[i]?.price);
    sum += Number.isFinite(p) && p >= 0 ? p : 0;
  }
  return sum;
}

/** One row per room; preserves existing row state when count changes. */
function ensureCoLivingRoomRows(n, prev) {
  const safe = Array.isArray(prev) ? prev : [];
  return Array.from({ length: n }, (_, i) => {
    if (safe[i]) {
      const r = safe[i];
      return { ...r, available_from: r.available_from ?? "" };
    }
    return {
      name: `Zimmer ${i + 1}`,
      price: "",
      floor: "",
      size_m2: "",
      status: "Frei",
      available_from: "",
    };
  });
}

function roundCurrency(value) {
  return Math.round(Number(value || 0));
}

function formatCurrency(value) {
  return `CHF ${roundCurrency(value).toLocaleString("de-CH")}`;
}

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

const MODAL_COST_TYPE_OPTIONS = [
  "Miete",
  "Nebenkosten",
  "Reinigung",
  "Internet",
  "Sonstiges",
];
const MODAL_COST_FIXED_SET = new Set([
  "Miete",
  "Nebenkosten",
  "Reinigung",
  "Internet",
]);

function newModalCostRowId() {
  return `mc-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function makeDefaultModalCostRows() {
  return [
    { id: newModalCostRowId(), cost_type: "Miete", custom_type: "", amount_chf: "", frequency: "monthly" },
    { id: newModalCostRowId(), cost_type: "Nebenkosten", custom_type: "", amount_chf: "", frequency: "monthly" },
    { id: newModalCostRowId(), cost_type: "Reinigung", custom_type: "", amount_chf: "", frequency: "monthly" },
  ];
}

function modalRowsFromApiCosts(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return makeDefaultModalCostRows();
  return rows.map((r) => {
    const ct = String(r.cost_type || "");
    const freq = String(r.frequency || "monthly").trim().toLowerCase() || "monthly";
    if (MODAL_COST_FIXED_SET.has(ct)) {
      return {
        id: r.id,
        cost_type: ct,
        custom_type: "",
        amount_chf: String(r.amount_chf ?? ""),
        frequency: freq,
      };
    }
    return {
      id: r.id,
      cost_type: "Sonstiges",
      custom_type: ct,
      amount_chf: String(r.amount_chf ?? ""),
      frequency: freq,
    };
  });
}

function parseModalCostAmount(raw) {
  const n = Number(String(raw ?? "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function resolveModalCostBackendType(row) {
  if (row.cost_type === "Sonstiges") return String(row.custom_type || "").trim();
  return String(row.cost_type || "").trim();
}

function buildValidModalCostRows(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const row of rows) {
    if (!row || !row.cost_type) continue;
    const ct = resolveModalCostBackendType(row);
    if (!ct) continue;
    const amt = parseModalCostAmount(row.amount_chf);
    if (amt == null) continue;
    const freq = String(row.frequency || "monthly").trim().toLowerCase() || "monthly";
    if (!["monthly", "yearly", "one_time"].includes(freq)) continue;
    out.push({ cost_type: ct, amount_chf: amt, frequency: freq });
  }
  return out;
}

function runningMonthlyCostsForUnit(unit, unitCostsRows) {
  if (!isLandlordContractLeaseStarted(unit)) return 0;
  return getUnitMonthlyRunningCosts(unit, unitCostsRows);
}

function calculateApartmentProfit(unit, unitCostsRows) {
  if (unit.current_revenue_chf == null) return null;
  const revenue = Number(unit.current_revenue_chf);
  if (!Number.isFinite(revenue)) return null;
  return revenue - runningMonthlyCostsForUnit(unit, unitCostsRows);
}

function SectionCard({ title, subtitle, children }) {
  const isApartment = title.includes("Business Apartments");
  return (
    <div className="overflow-hidden rounded-[12px] border border-[#1c2035] bg-[#10121a]">
      <div className="flex items-start gap-3 border-b border-[#1c2035] px-[18px] py-[14px]">
        <div
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] text-[13px] leading-none ${
            isApartment
              ? "border border-[rgba(157,124,244,0.2)] bg-[rgba(157,124,244,0.1)]"
              : "border border-[rgba(34,211,238,0.2)] bg-[rgba(34,211,238,0.1)]"
          }`}
        >
          {isApartment ? "🏢" : "🏠"}
        </div>
        <div className="min-w-0">
          <h3 className="flex items-center gap-[8px] text-[13px] font-medium text-[#edf0f7]">{title}</h3>
          {subtitle ? <p className="mt-[3px] text-[10px] text-[#4a5070]">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Visual-only badge classes for admin units tables (design tokens). */
function adminUnitsOccupancyBadgeClass(statusKey) {
  const base = "inline-block rounded-full px-2 py-[2px] text-[9px] font-semibold ";
  if (statusKey === "belegt") {
    return `${base}border border-[rgba(61,220,132,0.2)] bg-[rgba(61,220,132,0.1)] text-[#3ddc84]`;
  }
  if (statusKey === "frei") {
    return `${base}border border-[rgba(255,95,109,0.2)] bg-[rgba(255,95,109,0.1)] text-[#ff5f6d]`;
  }
  if (statusKey === "teilbelegt") {
    return `${base}border border-[rgba(245,166,35,0.2)] bg-[rgba(245,166,35,0.1)] text-[#f5a623]`;
  }
  if (statusKey === "reserviert") {
    return `${base}border border-[rgba(157,124,244,0.2)] bg-[rgba(157,124,244,0.1)] text-[#9d7cf4]`;
  }
  return `${base}border border-[#1c2035] bg-[#191c28] text-[#4a5070]`;
}

function ApartmentTable({ items, rooms, tenancies, unitCostsByUnitId, onEdit, onDelete }) {
  return (
    <SectionCard
      title="Business Apartments / klassische Apartments"
      subtitle="Einzelne vermietbare Einheiten mit einem Vertrag pro Apartment."
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="bg-[#10121a]">
            <tr>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Unit ID</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Ort</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">PLZ</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Adresse</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Typ</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Liegenschaft</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Status</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Zimmer</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Umsatz (aktuell)</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Mietkosten</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Gewinn</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Verfügbar ab</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Mietbeginn (Vertrag)</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Aktionen</th>
            </tr>
          </thead>

          <tbody>
            {items.map((unit, rowIdx) => {
              const occ = getUnitOccupancyStatus(unit, rooms, tenancies);
              const leaseEnded =
                String(unit.leaseStatus ?? unit.lease_status ?? "").trim() ===
                "ended";
              const unitCosts =
                unitCostsByUnitId?.[String(unit.id)] ??
                unitCostsByUnitId?.[unit.id] ??
                [];
              const occRooms = Number(unit.occupiedRooms) || 0;
              const totalRooms = Number(unit.rooms) || 0;
              let zimmerLineClass =
                "font-mono text-[11px] text-[#4a5070]";
              if (totalRooms > 0) {
                if (occRooms === 0) zimmerLineClass = "font-mono text-[11px] text-[#ff5f6d]";
                else if (occRooms === totalRooms) zimmerLineClass = "font-mono text-[11px] text-[#3ddc84]";
                else zimmerLineClass = "font-mono text-[11px] text-[#f5a623]";
              }
              const profitVal = calculateApartmentProfit(unit, unitCosts);
              return (
              <tr
                key={unit.id}
                className={`cursor-pointer border-b border-[#1c2035] text-[11px] text-[#8892b0] transition-colors hover:bg-[#141720] ${
                  leaseEnded ? "opacity-60" : ""
                } ${rowIdx === items.length - 1 ? "border-b-0" : ""}`}
              >
                <td className="align-middle px-[14px] py-[11px]">
                  <Link
                    to={`/admin/units/${unit.unitId}`}
                    className="block font-mono text-[11px] font-medium text-[#5b9cf6] hover:underline"
                  >
                    {getDisplayUnitId(unit)}
                  </Link>
                  <span className="mt-[2px] block max-w-[120px] truncate font-mono text-[8px] text-[#4a5070]">
                    {unit.unitId}
                  </span>
                </td>
                <td className="align-middle px-[14px] py-[11px] text-[11px] text-[#4a5070]">{unit.place}</td>
                <td className="align-middle px-[14px] py-[11px] text-[11px] text-[#4a5070]">{unit.zip}</td>
                <td className="align-middle px-[14px] py-[11px]">
                  <div className="flex items-center gap-[4px] text-[11px] text-[#5b9cf6]">
                    <span>{unit.address}</span>
                    {unit.address ? (
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            buildGoogleMapsSearchUrl(unit.address, unit.zip, unit.place),
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                        className="text-[9px] text-[#4a5070] hover:text-[#edf0f7]"
                        title="In Google Maps öffnen"
                      >
                        📍
                      </button>
                    ) : null}
                  </div>
                </td>
                <td className="align-middle px-[14px] py-[11px] text-[11px] text-[#4a5070]">{unit.type}</td>
                <td className="align-middle px-[14px] py-[11px] text-[11px] text-[#4a5070]">{unit.property_title || "—"}</td>
                <td className="align-middle px-[14px] py-[11px]">
                  {occ == null ? (
                    <span className="text-[#4a5070]">—</span>
                  ) : (
                    <span className={adminUnitsOccupancyBadgeClass(occ)}>
                      {formatOccupancyStatusDe(occ)}
                    </span>
                  )}
                </td>
                <td className="align-middle px-[14px] py-[11px]">
                  <div className={zimmerLineClass}>
                    {occRooms} / {totalRooms}
                  </div>
                  <div className="mt-[2px] text-[9px] text-[#4a5070]">Zimmer belegt</div>
                </td>
                <td className="align-middle px-[14px] py-[11px] font-mono text-[11px] text-[#edf0f7]">
                  {unit.current_revenue_chf == null ? "—" : formatCurrency(unit.current_revenue_chf)}
                </td>
                <td className="align-middle px-[14px] py-[11px] font-mono text-[11px] text-[#edf0f7]">
                  {formatCurrency(runningMonthlyCostsForUnit(unit, unitCosts))}
                </td>
                <td
                  className={`align-middle px-[14px] py-[11px] font-mono text-[11px] font-medium ${
                    profitVal == null
                      ? "text-[#8892b0]"
                      : profitVal >= 0
                        ? "text-[#3ddc84]"
                        : "text-[#ff5f6d]"
                  }`}
                >
                  {profitVal == null ? "—" : formatCurrency(profitVal)}
                </td>
                <td className="align-middle px-[14px] py-[11px] font-mono text-[11px] text-[#edf0f7]">{unit.availableFrom}</td>
                <td className="align-middle px-[14px] py-[11px] font-mono text-[11px] text-[#edf0f7]">
                  {unit.leaseStartDate || "—"}
                </td>
                <td className="align-middle px-[14px] py-[11px]">
                  <Link
                    to={`/admin/units/${unit.unitId}`}
                    className="inline-block whitespace-nowrap rounded-[6px] border border-[#1c2035] bg-[#141720] px-[10px] py-[3px] text-[10px] text-[#8892b0] transition-colors hover:border-[#242840] hover:text-[#edf0f7]"
                  >
                    Öffnen →
                  </Link>
                </td>
              </tr>
            );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan="14" className="py-8 text-center text-[11px] text-[#4a5070]">
                  Keine Apartments gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function coLivingCountCircleClass(n) {
  const v = Number(n) || 0;
  const base =
    "inline-flex h-[22px] w-[22px] items-center justify-center rounded-full font-mono text-[10px] font-semibold ";
  if (v === 0) {
    return `${base}border border-[#1c2035] bg-[#191c28] text-[#4a5070]`;
  }
  return base;
}

function CoLivingTable({ items, rooms, tenancies, unitCostsByUnitId, onEdit, onDelete }) {
  return (
    <SectionCard
      title="Co-Living Units"
      subtitle="Operative Kennzahlen aus Zimmerpreisen und Mietverhältnissen (Listenpreise / TenancyRevenue-Äquivalent). Auf der Unit-Detailseite: Backend-KPI-Monat."
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="bg-[#10121a]">
            <tr>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Unit ID</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Ort</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">PLZ</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Adresse</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Liegenschaft</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Status</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Belegt</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Reserviert</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Frei</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Potenzial (Listen)</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Einnahmen (Äquivalent)</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Differenz (Listen − Äquivalent)</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Deckungsbeitrag (Frontend)</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Mietbeginn (Vertrag)</th>
              <th className="whitespace-nowrap border-b border-[#1c2035] px-[14px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">Aktionen</th>
            </tr>
          </thead>

          <tbody>
            {items.map((unit, rowIdx) => {
              const metrics = getCoLivingMetrics(unit, rooms, tenancies);
              const unitCosts =
                unitCostsByUnitId?.[String(unit.id)] ??
                unitCostsByUnitId?.[unit.id] ??
                [];
              const currentProfit =
                Number(metrics.currentRevenue ?? 0) -
                runningMonthlyCostsForUnit(unit, unitCosts);
              const occ = getUnitOccupancyStatus(unit, rooms, tenancies);
              const leaseEnded =
                String(unit.leaseStatus ?? unit.lease_status ?? "").trim() ===
                "ended";
              const oc = metrics.occupiedCount;
              const rc = metrics.reservedCount;
              const fc = metrics.freeCount;

              return (
                <tr
                  key={unit.id}
                  className={`cursor-pointer border-b border-[#1c2035] text-[11px] text-[#8892b0] transition-colors hover:bg-[#141720] ${
                    leaseEnded ? "opacity-60" : ""
                  } ${rowIdx === items.length - 1 ? "border-b-0" : ""}`}
                >
                  <td className="align-middle px-[14px] py-[11px]">
                    <Link
                      to={`/admin/units/${unit.unitId}`}
                      className="block font-mono text-[11px] font-medium text-[#5b9cf6] hover:underline"
                    >
                      {getDisplayUnitId(unit)}
                    </Link>
                    <span className="mt-[2px] block max-w-[120px] truncate font-mono text-[8px] text-[#4a5070]">
                      {unit.unitId}
                    </span>
                  </td>
                  <td className="align-middle px-[14px] py-[11px] text-[11px] text-[#4a5070]">{unit.place}</td>
                <td className="align-middle px-[14px] py-[11px] text-[11px] text-[#4a5070]">{unit.zip}</td>
                <td className="align-middle px-[14px] py-[11px]">
                  <div className="flex items-center gap-[4px] text-[11px] text-[#5b9cf6]">
                    <span>{unit.address}</span>
                    {unit.address ? (
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            buildGoogleMapsSearchUrl(unit.address, unit.zip, unit.place),
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                        className="text-[9px] text-[#4a5070] hover:text-[#edf0f7]"
                        title="In Google Maps öffnen"
                      >
                        📍
                      </button>
                    ) : null}
                  </div>
                </td>
                <td className="align-middle px-[14px] py-[11px] text-[11px] text-[#4a5070]">{unit.property_title || "—"}</td>
                <td className="align-middle px-[14px] py-[11px]">
                  {occ == null ? (
                    <span className="text-[#4a5070]">—</span>
                  ) : (
                    <span className={adminUnitsOccupancyBadgeClass(occ)}>
                      {formatOccupancyStatusDe(occ)}
                    </span>
                  )}
                </td>
                  <td className="align-middle px-[14px] py-[11px]">
                    <span
                      className={`${coLivingCountCircleClass(oc)}${
                        oc > 0
                          ? " border border-[rgba(61,220,132,0.25)] bg-[rgba(61,220,132,0.12)] text-[#3ddc84]"
                          : ""
                      }`}
                    >
                      {oc}
                    </span>
                  </td>
                  <td className="align-middle px-[14px] py-[11px]">
                    <span
                      className={`${coLivingCountCircleClass(rc)}${
                        rc > 0
                          ? " border border-[rgba(157,124,244,0.25)] bg-[rgba(157,124,244,0.12)] text-[#9d7cf4]"
                          : ""
                      }`}
                    >
                      {rc}
                    </span>
                  </td>
                  <td className="align-middle px-[14px] py-[11px]">
                    <span
                      className={`${coLivingCountCircleClass(fc)}${
                        fc > 0
                          ? " border border-[rgba(255,95,109,0.25)] bg-[rgba(255,95,109,0.12)] text-[#ff5f6d]"
                          : ""
                      }`}
                    >
                      {fc}
                    </span>
                  </td>
                  <td className="align-middle px-[14px] py-[11px] font-mono text-[11px] text-[#edf0f7]">
                    {formatCurrency(metrics.fullRevenue)}
                  </td>
                  <td className="align-middle px-[14px] py-[11px] font-mono text-[11px] text-[#edf0f7]">
                    {formatCurrency(metrics.currentRevenue)}
                  </td>
                  <td className="align-middle px-[14px] py-[11px] font-mono text-[11px] text-[#edf0f7]">
                    {formatCurrency(metrics.vacancyLoss)}
                  </td>
                  <td
                    className={`align-middle px-[14px] py-[11px] font-mono text-[11px] font-medium ${
                      currentProfit >= 0 ? "text-[#3ddc84]" : "text-[#ff5f6d]"
                    }`}
                  >
                    {formatCurrency(currentProfit)}
                  </td>
                  <td className="align-middle px-[14px] py-[11px] font-mono text-[11px] text-[#edf0f7]">
                    {unit.leaseStartDate || "—"}
                  </td>
                  <td className="align-middle px-[14px] py-[11px]">
                    <Link
                      to={`/admin/units/${unit.unitId}`}
                      className="inline-block whitespace-nowrap rounded-[6px] border border-[#1c2035] bg-[#141720] px-[10px] py-[3px] text-[10px] text-[#8892b0] transition-colors hover:border-[#242840] hover:text-[#edf0f7]"
                    >
                      Öffnen →
                    </Link>
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan="15" className="py-8 text-center text-[11px] text-[#4a5070]">
                  Keine Co-Living Einheiten gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

const KPI_VISUAL = {
  "Units gesamt": { bar: "#5b9cf6", valueClass: "text-[20px] text-[#5b9cf6]" },
  Apartments: { bar: "#9d7cf4", valueClass: "text-[20px] text-[#9d7cf4]" },
  "Co-Living Units": { bar: "#22d3ee", valueClass: "text-[20px] text-[#22d3ee]" },
  Einnahmen: { bar: "#3ddc84", valueClass: "text-[17px] text-[#edf0f7]" },
  Deckungsbeitrag: { bar: "#f5a623", valueClass: "text-[17px] text-[#edf0f7]" },
};

function StatCard({ label, value, hint }) {
  const cfg = KPI_VISUAL[label] || KPI_VISUAL["Units gesamt"];
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[#1c2035] bg-[#10121a] p-[13px_15px] transition-colors hover:border-[#242840]">
      <div
        className="absolute left-0 right-0 top-0 h-[2px] rounded-t-[10px]"
        style={{ background: cfg.bar }}
      />
      <p className="mb-[5px] text-[9px] font-medium uppercase tracking-[0.5px] text-[#4a5070]">{label}</p>
      <p className={`mb-[4px] font-mono font-medium leading-none ${cfg.valueClass}`}>{value}</p>
      {hint ? <p className="text-[10px] leading-[1.4] text-[#4a5070]">{hint}</p> : null}
    </div>
  );
}

function AdminApartmentsPage() {
  const [units, setUnits] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenancies, setTenancies] = useState(null);
  const [properties, setProperties] = useState([]);
  const [landlords, setLandlords] = useState([]);
  const [propertyManagers, setPropertyManagers] = useState([]);
  const [landlordFilter, setLandlordFilter] = useState("");
  const [propertyManagerFilter, setPropertyManagerFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [unitCostsByUnitId, setUnitCostsByUnitId] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError("");

    Promise.allSettled([
      fetchAdminUnits(),
      fetchAdminRooms(),
      fetchAdminProperties(),
      fetchAdminLandlords(),
      fetchAdminPropertyManagers(),
      fetchAdminTenanciesAll(),
    ]).then((results) => {
      if (cancelled) return;

      const [unitsRes, roomsRes, propsRes, landlordsRes, pmRes, tenRes] = results;

      if (unitsRes.status === "fulfilled") {
        const data = unitsRes.value;
        setUnits(Array.isArray(data) ? data.map(normalizeUnit) : []);
      } else {
        console.error(unitsRes.reason);
        setFetchError(
          unitsRes.reason?.message || "Einheiten konnten nicht geladen werden."
        );
        setUnits([]);
      }

      if (roomsRes.status === "fulfilled") {
        const data = roomsRes.value;
        setRooms(Array.isArray(data) ? data.map(normalizeRoom) : []);
      } else {
        console.error(roomsRes.reason);
        setRooms([]);
      }

      if (propsRes.status === "fulfilled") {
        const data = propsRes.value;
        setProperties(Array.isArray(data) ? data : []);
      } else {
        console.error(propsRes.reason);
        setProperties([]);
      }

      if (landlordsRes.status === "fulfilled") {
        const data = landlordsRes.value;
        setLandlords(Array.isArray(data) ? data : []);
      } else {
        console.error(landlordsRes.reason);
        setLandlords([]);
      }

      if (pmRes.status === "fulfilled") {
        const data = pmRes.value;
        setPropertyManagers(Array.isArray(data) ? data : []);
      } else {
        console.error(pmRes.reason);
        setPropertyManagers([]);
      }

      if (tenRes.status === "fulfilled") {
        const data = tenRes.value;
        setTenancies(Array.isArray(data) ? data : []);
      } else {
        console.error(tenRes.reason);
        setTenancies(null);
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
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

  const [searchTerm, setSearchTerm] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [modalCostRows, setModalCostRows] = useState([]);
  const [coLivingRoomRows, setCoLivingRoomRows] = useState([]);
  const [unitAddrBusy, setUnitAddrBusy] = useState(false);
  const [unitCantonHint, setUnitCantonHint] = useState("");
  const [unitCantonLockedByPlz, setUnitCantonLockedByPlz] = useState(false);
  const [unitPlzNotFound, setUnitPlzNotFound] = useState(false);
  const [unitLastGeocoding, setUnitLastGeocoding] = useState(null);
  const [unitCoordSnapshot, setUnitCoordSnapshot] = useState(null);
  const [unitGeocodingRetrying, setUnitGeocodingRetrying] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const normalizedUnitType = normalizeUnitTypeLabel(formData.type);
  const isCoLivingType = normalizedUnitType === "Co-Living";
  const parsedRoomsTotal = useMemo(
    () => parseRoomsTotal(formData.rooms),
    [formData.rooms]
  );

  const coLivingRowsForDisplay = useMemo(() => {
    if (!isCoLivingType || editingId || parsedRoomsTotal <= 0) return [];
    return ensureCoLivingRoomRows(parsedRoomsTotal, coLivingRoomRows);
  }, [isCoLivingType, editingId, parsedRoomsTotal, coLivingRoomRows]);

  const coLivingOccupiedClamped = useMemo(() => {
    if (!isCoLivingType) return 0;
    return 0;
  }, [isCoLivingType]);

  const coLivingFullOccupancyRevenue = useMemo(() => {
    if (!isCoLivingType) return 0;
    const rows = coLivingRowsForDisplay;
    if (rows.length > 0 && rows.length === parsedRoomsTotal && parsedRoomsTotal > 0) {
      return sumCoLivingRoomPricesChf(rows);
    }
    return 0;
  }, [
    isCoLivingType,
    coLivingRowsForDisplay,
    parsedRoomsTotal,
  ]);

  const derivedMonthlyTotalCosts = useMemo(() => {
    const unitLike = {
      landlordDepositType: formData.landlordDepositType,
      landlordDepositAnnualPremium: formData.landlordDepositAnnualPremium,
    };
    return getUnitMonthlyRunningCosts(unitLike, modalCostRows);
  }, [formData.landlordDepositType, formData.landlordDepositAnnualPremium, modalCostRows]);

  const derivedOneTimeCostsTotal = useMemo(() => {
    if (!Array.isArray(modalCostRows)) return 0;
    return modalCostRows.reduce((sum, r) => {
      const freq = String(r?.frequency || "monthly").trim().toLowerCase();
      if (freq !== "one_time") return sum;
      const amt = Number(r?.amount_chf);
      return sum + (Number.isFinite(amt) && amt > 0 ? amt : 0);
    }, 0);
  }, [modalCostRows]);

  const nextUnitId = useMemo(() => {
    const maxNumber = units.reduce((max, item) => {
      const uid = item.unitId || item.id || "";
      const parts = String(uid).split("-");
      const number = parseInt(parts[parts.length - 1] || "0", 10);
      return !isNaN(number) && number > max ? number : max;
    }, 0);
    return `FAH-U-${String(maxNumber + 1).padStart(4, "0")}`;
  }, [units]);

  const unitGeoLine = useMemo(
    () =>
      unitGeocodingStatusPresentation(
        unitLastGeocoding,
        unitCoordSnapshot,
        !editingId
      ),
    [unitLastGeocoding, unitCoordSnapshot, editingId]
  );

  // useLayoutEffect: must run before paint so room blocks exist before submit (Enter) in the same tick as the last rooms change.
  useLayoutEffect(() => {
    if (!isModalOpen || editingId) return;
    if (!isCoLivingType) {
      setCoLivingRoomRows([]);
      return;
    }
    const n = parsedRoomsTotal;
    if (n === 0) {
      setCoLivingRoomRows([]);
      return;
    }
    setCoLivingRoomRows((prev) => ensureCoLivingRoomRows(n, prev));
  }, [isModalOpen, editingId, isCoLivingType, parsedRoomsTotal]);

  const filteredUnits = useMemo(() => {
    let result = units;
    const search = searchTerm.toLowerCase().trim();
    if (search) {
      result = result.filter((unit) => {
        const a = String(unit.unitId || unit.id || "").toLowerCase();
        const b = String(unit.place || unit.city || "").toLowerCase();
        const c = String(unit.zip || "").toLowerCase();
        const d = String(unit.address || "").toLowerCase();
        const e = String(unit.type || "").toLowerCase();
        const occ = getUnitOccupancyStatus(unit, rooms, tenancies);
        const f = formatOccupancyStatusDe(occ).toLowerCase();
        const g = String(unit.property_title || "").toLowerCase();
        return (
          a.includes(search) ||
          b.includes(search) ||
          c.includes(search) ||
          d.includes(search) ||
          e.includes(search) ||
          f.includes(search) ||
          g.includes(search)
        );
      });
    }
    if (propertyFilter) {
      result = result.filter((unit) => String(unit.property_id || "") === String(propertyFilter));
    }
    return result;
  }, [units, searchTerm, propertyFilter, rooms, tenancies]);

  const filteredLandlordsForSelect = useMemo(() => {
    const q = landlordFilter.toLowerCase().trim();
    if (!q) return landlords;
    return landlords.filter((l) => {
      const blob = `${l.company_name || ""} ${l.contact_name || ""} ${l.email || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [landlords, landlordFilter]);

  const filteredPropertyManagersForSelect = useMemo(() => {
    const q = propertyManagerFilter.toLowerCase().trim();
    if (!q) return propertyManagers;
    return propertyManagers.filter((p) => {
      const blob = `${p.name || ""} ${p.email || ""} ${p.phone || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [propertyManagers, propertyManagerFilter]);

  const apartmentUnits = filteredUnits.filter((item) => item.type === "Apartment");
  const coLivingUnits = filteredUnits.filter((item) => item.type === "Co-Living");

  const summary = useMemo(() => {
    const totalUnits = filteredUnits.length;
    const totalApartments = apartmentUnits.length;
    const totalCoLivingUnits = coLivingUnits.length;

    const currentRevenue = filteredUnits.reduce((sum, unit) => {
      if (!Array.isArray(tenancies)) return sum;
      if (unit.type === "Apartment") {
        return sum + sumActiveTenancyMonthlyRentForUnit(unit, tenancies);
      }

      const metrics = getCoLivingMetrics(unit, rooms, tenancies);
      return sum + Number(metrics.currentRevenue || 0);
    }, 0);

    const runningCosts = filteredUnits.reduce((sum, unit) => {
      const rows =
        unitCostsByUnitId[String(unit.id)] ?? unitCostsByUnitId[unit.id] ?? [];
      return sum + runningMonthlyCostsForUnit(unit, rows);
    }, 0);

    return {
      totalUnits,
      totalApartments,
      totalCoLivingUnits,
      currentRevenue,
      runningCosts,
      currentProfit: currentRevenue - runningCosts,
    };
  }, [
    filteredUnits,
    apartmentUnits.length,
    coLivingUnits.length,
    rooms,
    tenancies,
    unitCostsByUnitId,
  ]);

  function handleOpenCreateModal() {
    setEditingId(null);
    setFormData(emptyForm);
    setModalCostRows(makeDefaultModalCostRows());
    setCoLivingRoomRows([]);
    setLandlordFilter("");
    setPropertyManagerFilter("");
    setUnitAddrBusy(false);
    setUnitCantonHint("");
    setUnitCantonLockedByPlz(false);
    setUnitPlzNotFound(false);
    setUnitLastGeocoding(null);
    setUnitCoordSnapshot(null);
    setUnitGeocodingRetrying(false);
    setIsModalOpen(true);
  }

  const handleOpenEditModal = useCallback(async (unit) => {
    setEditingId(unit.id);
    setLandlordFilter("");
    setPropertyManagerFilter("");
    setFormData({
      place: unit.place,
      zip: unit.zip != null && unit.zip !== "" ? String(unit.zip) : "",
      address: unit.address,
      canton: "",
      type: unit.type,
      rooms: unit.rooms,
      occupiedRooms: unit.occupiedRooms || 0,
      property_id: unit.property_id || "",
      landlord_id:
        unit.landlord_id != null && unit.landlord_id !== ""
          ? String(unit.landlord_id)
          : "",
      property_manager_id:
        unit.property_manager_id != null && unit.property_manager_id !== ""
          ? String(unit.property_manager_id)
          : "",
      tenantPriceMonthly: numFieldStr(unit.tenantPriceMonthly),
      availableFrom: numFieldStr(unit.availableFrom).slice(0, 10),
      landlordDepositType: String(unit.landlordDepositType || "").trim(),
      landlordDepositAmount: numFieldStr(unit.landlordDepositAmount),
      landlordDepositAnnualPremium: numFieldStr(unit.landlordDepositAnnualPremium),
      leaseType: String(unit.leaseType ?? "").trim(),
      leaseStartDate: numFieldStr(unit.leaseStartDate).slice(0, 10),
      leaseEndDate: numFieldStr(unit.leaseEndDate).slice(0, 10),
      noticeGivenDate: numFieldStr(unit.noticeGivenDate).slice(0, 10),
      terminationEffectiveDate: numFieldStr(unit.terminationEffectiveDate).slice(
        0,
        10
      ),
      returnedToLandlordDate: numFieldStr(unit.returnedToLandlordDate).slice(0, 10),
      leaseStatus: String(unit.leaseStatus ?? "").trim(),
      leaseNotes: unit.leaseNotes != null ? String(unit.leaseNotes) : "",
    });
    setSaveError("");
    setUnitAddrBusy(false);
    setUnitCantonHint("");
    setUnitCantonLockedByPlz(false);
    setUnitPlzNotFound(false);
    setUnitLastGeocoding(null);
    setUnitCoordSnapshot(
      unit.latitude != null && unit.longitude != null
        ? { lat: unit.latitude, lng: unit.longitude }
        : { lat: null, lng: null }
    );
    setUnitGeocodingRetrying(false);
    let costRows = makeDefaultModalCostRows();
    try {
      const costs = await fetchAdminUnitCosts(unit.id);
      costRows = modalRowsFromApiCosts(costs);
    } catch {
      costRows = makeDefaultModalCostRows();
    }
    setModalCostRows(costRows);
    setIsModalOpen(true);
  }, []);

  useEffect(() => {
    const raw = location.state?.editUnitId;
    if (raw == null || raw === "") return;
    if (units.length === 0) return;
    const id = String(raw);
    const unit = units.find(
      (u) => String(u.id) === id || String(u.unitId) === id
    );
    if (unit) {
      handleOpenEditModal(unit);
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [units, location.state, location.pathname, navigate, handleOpenEditModal]);

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(emptyForm);
    setModalCostRows([]);
    setCoLivingRoomRows([]);
    setLandlordFilter("");
    setPropertyManagerFilter("");
    setUnitAddrBusy(false);
    setUnitCantonHint("");
    setUnitCantonLockedByPlz(false);
    setUnitPlzNotFound(false);
    setUnitLastGeocoding(null);
    setUnitCoordSnapshot(null);
    setUnitGeocodingRetrying(false);
  }

  function addModalCostRow() {
    setModalCostRows((prev) => [
      ...prev,
      {
        id: newModalCostRowId(),
        cost_type: "",
        custom_type: "",
        amount_chf: "",
        frequency: "monthly",
      },
    ]);
  }

  const handleUnitPostalCodeChange = (e) => {
    const next = e.target.value;
    const plz = next.trim();
    if (!/^\d{4}$/.test(plz)) {
      setUnitCantonLockedByPlz(false);
      setUnitPlzNotFound(false);
      setFormData((f) => ({ ...f, zip: next }));
      return;
    }
    const hit = lookupSwissPlz(plz);
    if (hit) {
      setFormData((f) => ({
        ...f,
        zip: next,
        place: hit.city,
        canton: hit.canton,
      }));
      setUnitCantonLockedByPlz(true);
      setUnitPlzNotFound(false);
    } else {
      setFormData((f) => ({ ...f, zip: next }));
      setUnitCantonLockedByPlz(false);
      setUnitPlzNotFound(true);
    }
  };

  function removeModalCostRow(rowId) {
    setModalCostRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  function updateModalCostRow(rowId, patch) {
    setModalCostRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r))
    );
  }

  function handleCoLivingRoomChange(index, field, rawValue) {
    setCoLivingRoomRows((prev) => {
      const base = ensureCoLivingRoomRows(parsedRoomsTotal, prev);
      const next = [...base];
      if (index < 0 || index >= next.length) return prev;
      next[index] = { ...next[index], [field]: rawValue };
      return next;
    });
  }

  function handleChange(event) {
    const { name, value } = event.target;

    let nextValue = value;

    if (name === "occupiedRooms") {
      const totalRooms = parseRoomsTotal(formData.rooms);
      let occupied = Number(value);
      if (Number.isNaN(occupied)) occupied = 0;
      occupied = Math.floor(occupied);
      if (occupied < 0) occupied = 0;
      if (totalRooms > 0 && occupied > totalRooms) occupied = totalRooms;
      nextValue = occupied;
    }

    if (name === "type" && value === "Apartment") {
      setFormData((prev) => ({
        ...prev,
        type: value,
        occupiedRooms: 0,
      }));
      return;
    }

    if (name === "type" && value === "Co-Living") {
      setFormData((prev) => ({
        ...prev,
        type: value,
        occupiedRooms: 0,
      }));
      return;
    }

    if (name === "landlordDepositType" && value !== "insurance") {
      setFormData((prev) => ({
        ...prev,
        landlordDepositType: value,
        landlordDepositAnnualPremium: "",
      }));
      return;
    }

    if (name === "leaseType" && value !== "fixed_term") {
      setFormData((prev) => ({
        ...prev,
        leaseType: value,
        leaseEndDate: "",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaveError("");

    const validCostRows = buildValidModalCostRows(modalCostRows);
    if (validCostRows.length === 0) {
      setSaveError(
        "Mindestens eine Kosten-Zeile mit Kostenart, Frequenz und gültigem Betrag ist erforderlich."
      );
      return;
    }

    const coLivingRowsForSubmit =
      !editingId && isCoLivingType && parsedRoomsTotal > 0
        ? ensureCoLivingRoomRows(parsedRoomsTotal, coLivingRoomRows)
        : coLivingRoomRows;

    if (!editingId && isCoLivingType) {
      const n = parsedRoomsTotal;
      if (n > 0) {
        if (coLivingRowsForSubmit.length !== n) {
          setSaveError(
            "Bei Co-Living muss die Anzahl Zimmer mit den ausgefüllten Zimmerzeilen übereinstimmen."
          );
          return;
        }
        for (let i = 0; i < n; i++) {
          const row = coLivingRowsForSubmit[i];
          if (!row || !String(row.name || "").trim()) {
            setSaveError(`Zimmer ${i + 1}: Name ist erforderlich.`);
            return;
          }
          if (row.price === "" || row.price === null || row.price === undefined) {
            setSaveError(`Zimmer ${i + 1}: Preis ist erforderlich.`);
            return;
          }
          const prn = Number(String(row.price).replace(",", "."));
          if (Number.isNaN(prn) || prn < 0) {
            setSaveError(`Zimmer ${i + 1}: Ungültiger Preis.`);
            return;
          }
          if (row.floor !== "" && row.floor != null) {
            const fl = Number(String(row.floor).replace(",", "."));
            if (Number.isNaN(fl) || fl < 0) {
              setSaveError(`Zimmer ${i + 1}: Ungültige Etage.`);
              return;
            }
          }
          if (row.size_m2 !== "" && row.size_m2 != null) {
            const sm = Number(String(row.size_m2).replace(",", "."));
            if (Number.isNaN(sm) || sm < 0) {
              setSaveError(`Zimmer ${i + 1}: Ungültige Fläche (m²).`);
              return;
            }
          }
        }
      }
    }

    setSaving(true);

    const computedLeaseStatus = computeLeaseStatusKey(formData) || null;
    const persistedUnitFields = {
      tenant_price_monthly_chf: 0,
      available_from: dateOnlyOrNull(formData.availableFrom),
      occupied_rooms: Math.max(0, Math.floor(Number(formData.occupiedRooms) || 0)),
      postal_code: String(formData.zip || "").trim() || null,
      landlord_deposit_type: String(formData.landlordDepositType || "").trim() || null,
      landlord_deposit_amount: parseOptionalMoneyChf(formData.landlordDepositAmount),
      landlord_deposit_annual_premium: parseOptionalMoneyChf(
        formData.landlordDepositAnnualPremium
      ),
      lease_type: strOrNull(formData.leaseType),
      lease_start_date: dateOnlyOrNull(formData.leaseStartDate),
      lease_end_date:
        formData.leaseType === "fixed_term"
          ? dateOnlyOrNull(formData.leaseEndDate)
          : null,
      notice_given_date: dateOnlyOrNull(formData.noticeGivenDate),
      termination_effective_date: dateOnlyOrNull(
        formData.terminationEffectiveDate
      ),
      returned_to_landlord_date: dateOnlyOrNull(formData.returnedToLandlordDate),
      lease_status: computedLeaseStatus,
      lease_notes: strOrNull(formData.leaseNotes),
    };

    const baseUnitPayload = {
      title: (formData.place || formData.address || "Unit").trim() || "Unit",
      address: (formData.address || "").trim() || "",
      city: (formData.place || "").trim() || "",
      city_id: null,
      type: normalizedUnitType || null,
      rooms: parsedRoomsTotal,
      property_id: (formData.property_id || "").trim() || null,
      landlord_id: (formData.landlord_id || "").trim() || null,
      property_manager_id: (formData.property_manager_id || "").trim() || null,
    };

    const apiPayload = {
      ...baseUnitPayload,
      ...persistedUnitFields,
    };

    if (!editingId && isCoLivingType) {
      const n = parsedRoomsTotal;
      if (n > 0) {
        apiPayload.co_living_rooms = coLivingRowsForSubmit.map((row) => {
          const floorRaw = row.floor;
          const floor =
            floorRaw === "" || floorRaw == null
              ? null
              : Math.round(Number(String(floorRaw).replace(",", ".")));
          const sizeRaw = row.size_m2;
          const size_m2 =
            sizeRaw === "" || sizeRaw == null
              ? null
              : Number(String(sizeRaw).replace(",", "."));
          return {
            name: String(row.name).trim(),
            price: Math.round(Number(String(row.price).replace(",", "."))),
            floor,
            size_m2,
            status: "Frei",
          };
        });
      }
    }

    try {
      if (editingId) {
        const saved = await updateAdminUnit(editingId, {
          ...baseUnitPayload,
          ...persistedUnitFields,
        });
        if (saved) {
          setUnitLastGeocoding(saved.geocoding ?? null);
          setUnitCoordSnapshot(
            saved.latitude != null && saved.longitude != null
              ? { lat: saved.latitude, lng: saved.longitude }
              : { lat: null, lng: null }
          );
        }
        const g = saved && saved.geocoding;
        if (g && g.status !== "ok" && g.reason && g.reason !== "unchanged") {
          const reason = g.reason;
          let msg =
            "Unit gespeichert, aber Koordinaten konnten nicht automatisch ermittelt werden.";
          if (reason === "incomplete_address") {
            msg =
              "Unit gespeichert, aber die Adresse war für die automatische Kartenposition unvollständig.";
          } else if (reason === "provider_unavailable") {
            msg =
              "Unit gespeichert, aber Koordinaten konnten nicht automatisch ermittelt werden (Geocoding nicht konfiguriert).";
          }
          toast.warning(msg);
        }
        const existing = await fetchAdminUnitCosts(editingId);
        for (const c of existing) {
          await deleteAdminUnitCost(editingId, c.id);
        }
        for (const row of validCostRows) {
          await createAdminUnitCost(editingId, {
            cost_type: row.cost_type,
            amount_chf: row.amount_chf,
            frequency: row.frequency,
          });
        }
      } else {
        const created = await createAdminUnit(apiPayload);
        const g = created && created.geocoding;
        if (g && g.status !== "ok" && g.reason && g.reason !== "unchanged") {
          const reason = g.reason;
          let msg =
            "Unit gespeichert, aber Koordinaten konnten nicht automatisch ermittelt werden.";
          if (reason === "incomplete_address") {
            msg =
              "Unit gespeichert, aber die Adresse war für die automatische Kartenposition unvollständig.";
          } else if (reason === "provider_unavailable") {
            msg =
              "Unit gespeichert, aber Koordinaten konnten nicht automatisch ermittelt werden (Geocoding nicht konfiguriert).";
          }
          toast.warning(msg);
        }
        const newId = created?.id || created?.unitId;
        if (!newId) {
          throw new Error("Unit konnte nicht gespeichert werden.");
        }
        for (const row of validCostRows) {
          await createAdminUnitCost(newId, {
            cost_type: row.cost_type,
            amount_chf: row.amount_chf,
            frequency: row.frequency,
          });
        }
      }

      const [unitsData, roomsData, tenanciesData] = await Promise.all([
        fetchAdminUnits(),
        fetchAdminRooms(),
        fetchAdminTenanciesAll(),
      ]);
      setUnits(Array.isArray(unitsData) ? unitsData.map(normalizeUnit) : []);
      setRooms(Array.isArray(roomsData) ? roomsData.map(normalizeRoom) : []);
      setTenancies(Array.isArray(tenanciesData) ? tenanciesData : []);
      handleCloseModal();
    } catch (e) {
      const msg =
        (typeof e === "string" && e) ||
        (e && typeof e.message === "string" && e.message) ||
        (e != null && String(e)) ||
        "Speichern fehlgeschlagen.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  const handleRetryUnitGeocode = useCallback(() => {
    if (!editingId || unitGeocodingRetrying) return;
    setUnitGeocodingRetrying(true);
    geocodeAdminUnit(editingId)
      .then((data) => {
        setUnitLastGeocoding(data.geocoding ?? null);
        setUnitCoordSnapshot(
          data.latitude != null && data.longitude != null
            ? { lat: data.latitude, lng: data.longitude }
            : { lat: null, lng: null }
        );
        const g = data.geocoding;
        if (g && g.status === "ok") {
          toast.success("Koordinaten erfolgreich aktualisiert.");
        } else if (g && g.reason === "incomplete_address") {
          toast.warning("Adresse unvollständig – Koordinaten konnten nicht ermittelt werden.");
        } else if (g && g.reason === "provider_unavailable") {
          toast.warning("Geocoding nicht verfügbar.");
        } else {
          toast.warning("Koordinaten konnten nicht automatisch ermittelt werden.");
        }
        return Promise.all([
          fetchAdminUnits(),
          fetchAdminRooms(),
          fetchAdminTenanciesAll(),
        ]).then(([unitsData, roomsData, tenanciesData]) => {
          setUnits(Array.isArray(unitsData) ? unitsData.map(normalizeUnit) : []);
          setRooms(Array.isArray(roomsData) ? roomsData.map(normalizeRoom) : []);
          setTenancies(Array.isArray(tenanciesData) ? tenanciesData : []);
        });
      })
      .catch((e) => toast.error(e.message || "Geocoding fehlgeschlagen."))
      .finally(() => setUnitGeocodingRetrying(false));
  }, [editingId, unitGeocodingRetrying]);

  function handleDelete(id) {
    const unitRooms = getRoomsForUnit(id, rooms);
    const confirmMsg =
      unitRooms.length > 0
        ? "Diese Unit enthält noch Zimmer. Wirklich löschen?"
        : "Möchtest du diese Unit wirklich löschen?";
    const confirmed = window.confirm(confirmMsg);

    if (!confirmed) return;

    setDeleteError("");
    deleteAdminUnit(id)
      .then(() => {
        setUnits((prev) => prev.filter((item) => item.id !== id));
        setRooms((prev) =>
          prev.filter(
            (r) => String(r.unitId || r.unit_id) !== String(id)
          )
        );
        return Promise.all([
          fetchAdminUnits(),
          fetchAdminRooms(),
          fetchAdminTenanciesAll(),
        ])
          .then(([unitsData, roomsData, tenanciesData]) => {
            setUnits(
              Array.isArray(unitsData) ? unitsData.map(normalizeUnit) : []
            );
            setRooms(
              Array.isArray(roomsData) ? roomsData.map(normalizeRoom) : []
            );
            setTenancies(Array.isArray(tenanciesData) ? tenanciesData : []);
          })
          .catch((refetchErr) => {
            setDeleteError(
              `Gelöscht. Liste konnte nicht aktualisiert werden: ${
                refetchErr?.message || String(refetchErr)
              }`
            );
          });
      })
      .catch((e) => {
        const msg =
          (e && typeof e.message === "string" && e.message) ||
          (e != null && String(e)) ||
          "Löschen fehlgeschlagen.";
        setDeleteError(msg);
      });
  }

  const formLeaseStarted =
    !formData.leaseStartDate ||
    formData.leaseStartDate <= getTodayDateString();

  const formRunningMonthlyCosts = useMemo(() => {
    if (!formLeaseStarted) return 0;
    return modalCostRows.reduce((sum, row) => {
      const n = parseModalCostAmount(row.amount_chf);
      return sum + (n != null ? n : 0);
    }, 0);
  }, [formLeaseStarted, modalCostRows]);

  const currentApartmentProfit =
    Number(formData.tenantPriceMonthly || 0) - formRunningMonthlyCosts;

  const currentFreeRooms = isCoLivingType
    ? Math.max(parsedRoomsTotal - coLivingOccupiedClamped, 0)
    : "-";

  const currentCoLivingRevenue =
    isCoLivingType && parsedRoomsTotal > 0 && formLeaseStarted
      ? coLivingRowsForDisplay.length > 0 &&
        coLivingRowsForDisplay.length === parsedRoomsTotal
        ? sumFirstNCoLivingRoomPricesChf(
            coLivingRowsForDisplay,
            coLivingOccupiedClamped
          )
        : (coLivingFullOccupancyRevenue / parsedRoomsTotal) *
          coLivingOccupiedClamped
      : 0;

  const currentCoLivingVacancy =
    isCoLivingType && formLeaseStarted
      ? coLivingFullOccupancyRevenue - currentCoLivingRevenue
      : 0;

  const currentCoLivingProfit =
    currentCoLivingRevenue - formRunningMonthlyCosts;

  return (
    <div data-testid="admin-apartments-page" className="min-h-screen bg-[#080a0f] text-[#edf0f7]">
      <header className="sticky top-0 z-30 flex min-h-[50px] flex-wrap items-center justify-between gap-4 border-b border-[#1c2035] bg-[#0c0e15] px-6 py-2 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-[#edf0f7]">
              Van<span className="text-[#5b9cf6]">tio</span>
            </span>
            <span className="text-[#4a5070]">·</span>
            <span className="truncate text-[14px] font-medium text-[#edf0f7]">Apartments / Units</span>
          </div>
          <p className="mt-[3px] max-w-[720px] text-[10px] leading-snug text-[#4a5070]">
            Verwalte hier alle vermietbaren Einheiten, also Apartments und Co-Living Units.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-block shrink-0 whitespace-nowrap rounded-[6px] border border-[rgba(91,156,246,0.28)] bg-[rgba(91,156,246,0.1)] px-[14px] py-[5px] text-[11px] font-medium text-[#5b9cf6]"
        >
          + Unit hinzufügen
        </button>
      </header>

      <div className="mx-auto max-w-[min(1400px,100%)] px-6 py-5">
      {loading && (
        <div className="rounded-[12px] border border-[#1c2035] bg-[#10121a] p-8 text-center text-[13px] text-[#8892b0]">
          Laden…
        </div>
      )}

      {!loading && fetchError && (
        <div className="rounded-[12px] border border-[rgba(255,95,109,0.25)] bg-[rgba(255,95,109,0.08)] p-8 text-center text-[13px] text-[#ff5f6d]">
          {fetchError}
        </div>
      )}

      {!loading && deleteError && (
        <div className="mb-4 rounded-[10px] border border-[rgba(255,95,109,0.25)] bg-[rgba(255,95,109,0.08)] p-4 text-center text-[13px] text-[#ff5f6d]">
          {deleteError}
        </div>
      )}

      {!loading && !fetchError && units.length === 0 && (
        <div className="rounded-[12px] border border-[#1c2035] bg-[#10121a] p-8 text-center text-[13px] text-[#8892b0]">
          Keine Daten vorhanden
        </div>
      )}

      {!loading && !fetchError && units.length > 0 && (
        <>
          <div className="mb-[12px] flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.8px] text-[#4a5070]">Kennzahlen</span>
            <div className="h-px flex-1 bg-[#1c2035]" />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Units gesamt"
              value={summary.totalUnits}
              hint="Alle gefilterten Einheiten"
            />
            <StatCard
              label="Apartments"
              value={summary.totalApartments}
              hint="Klassische Einzelwohnungen"
            />
            <StatCard
              label="Co-Living Units"
              value={summary.totalCoLivingUnits}
              hint="Mehrzimmer-Einheiten"
            />
            <StatCard
              label="Einnahmen"
              value={formatCurrency(summary.currentRevenue)}
              hint="Summe aktiver Verträge (TenancyRevenue-Monatsäquivalent, heute). Kein Backend-KPI-Monatsumsatz."
            />
            <StatCard
              label="Deckungsbeitrag"
              value={formatCurrency(summary.currentProfit)}
              hint="Einnahmen-Äquivalent minus laufende Kosten (Frontend). Kein profit_service-Monat."
            />
          </div>

          <div className="mb-[12px] flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.8px] text-[#4a5070]">Suche &amp; Filter</span>
            <div className="h-px flex-1 bg-[#1c2035]" />
          </div>

          <div className="mb-6 flex items-center gap-[10px] rounded-[10px] border border-[#1c2035] bg-[#10121a] px-[16px] py-[12px]">
            <svg
              className="h-[14px] w-[14px] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                stroke="#4a5070"
                strokeWidth="1.5"
              />
              <path d="M16.5 16.5 21 21" stroke="#4a5070" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Suche nach Unit ID, Ort, PLZ, Adresse, Typ oder Belegung…"
              className="min-w-0 flex-1 border-none bg-transparent font-['DM_Sans'] text-[13px] text-[#edf0f7] outline-none placeholder:text-[#4a5070]"
            />
            <div className="h-[20px] w-px shrink-0 bg-[#1c2035]" />
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="max-w-[min(240px,45vw)] cursor-pointer appearance-none border-none bg-transparent pr-[16px] font-['DM_Sans'] text-[12px] text-[#8892b0] outline-none"
            >
              <option value="">Alle Liegenschaften</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.title || p.id}</option>
              ))}
            </select>
          </div>

          <div className="mb-[12px] flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.8px] text-[#4a5070]">Business Apartments</span>
            <div className="h-px flex-1 bg-[#1c2035]" />
          </div>

          <div className="mb-8">
            <ApartmentTable
              items={apartmentUnits}
              rooms={rooms}
              tenancies={tenancies}
              unitCostsByUnitId={unitCostsByUnitId}
              onEdit={handleOpenEditModal}
              onDelete={handleDelete}
            />
          </div>

          <div className="mb-[12px] flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.8px] text-[#4a5070]">Co-Living Units</span>
            <div className="h-px flex-1 bg-[#1c2035]" />
          </div>

          <div className="space-y-6">
            <CoLivingTable
              items={coLivingUnits}
              rooms={rooms}
              tenancies={tenancies}
              unitCostsByUnitId={unitCostsByUnitId}
              onEdit={handleOpenEditModal}
              onDelete={handleDelete}
            />
          </div>
        </>
      )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[14px] border border-black/10 dark:border-white/[0.07] bg-white dark:bg-[#141824] p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-[18px] font-bold text-[#0f172a] dark:text-[#eef2ff]">
                  {editingId ? "Unit bearbeiten" : "Neue Unit hinzufügen"}
                </h3>
                <p className="mt-1 text-[12px] text-[#64748b] dark:text-[#6b7a9a]">
                  {editingId
                    ? "Bearbeite hier die vorhandene Unit."
                    : "Die Unit ID wird automatisch vergeben."}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="text-2xl leading-none text-[#64748b] dark:text-[#6b7a9a] hover:text-[#0f172a] dark:hover:text-[#eef2ff]"
              >
                ×
              </button>
            </div>

            <div className="mb-6 rounded-[10px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] p-4">
              <p className="text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                {editingId ? "Unit ID" : "Automatische Unit ID"}
              </p>
              <p className="mt-1 text-[16px] font-bold text-[#0f172a] dark:text-[#eef2ff]">
                {editingId
                  ? units.find((item) => item.id === editingId)?.unitId
                  : nextUnitId}
              </p>
            </div>

            {saveError && (
              <p className="mb-4 text-[13px] text-[#f87171]">{saveError}</p>
            )}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                    Ort
                  </label>
                  <input
                    type="text"
                    name="place"
                    value={formData.place}
                    onChange={handleChange}
                    required
                    className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                    PLZ
                  </label>
                  <input
                    type="text"
                    name="zip"
                    value={formData.zip}
                    onChange={handleUnitPostalCodeChange}
                    required
                    className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                  />
                  {unitPlzNotFound ? (
                    <p className="mt-1 text-xs text-[#64748b] dark:text-[#6b7a9a]">PLZ nicht gefunden</p>
                  ) : null}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                    Adresse
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                    className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                  />
                </div>

                <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
                  <p className={unitGeoLine.className}>{unitGeoLine.text}</p>
                  {editingId ? (
                    <button
                      type="button"
                      onClick={handleRetryUnitGeocode}
                      disabled={saving || unitGeocodingRetrying}
                      className="shrink-0 rounded-[8px] border border-black/10 dark:border-white/[0.1] bg-transparent px-3 py-2 text-xs font-semibold text-[#64748b] hover:bg-slate-100 dark:text-[#8090b0] dark:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {unitGeocodingRetrying ? "Berechne …" : "Koordinaten erneut berechnen"}
                    </button>
                  ) : null}
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                  <div className="md:col-span-1">
                    <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                      Kanton (optional)
                    </label>
                    <select
                      name="canton"
                      value={formData.canton || ""}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, canton: e.target.value }))
                      }
                      disabled={saving || unitCantonLockedByPlz}
                      className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none disabled:opacity-50"
                    >
                      <option value="">—</option>
                      {formData.canton && !SWISS_CANTON_CODES.includes(formData.canton) ? (
                        <option value={formData.canton}>{formData.canton}</option>
                      ) : null}
                      {SWISS_CANTON_CODES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-1.5 pt-7">
                    <button
                      type="button"
                      onClick={() => {
                        window.open(
                          buildGoogleMapsSearchUrl(
                            formData.address,
                            formData.zip,
                            formData.place
                          ),
                          "_blank",
                          "noopener,noreferrer"
                        );
                        setUnitAddrBusy(true);
                        setUnitCantonHint("Kanton wird ermittelt …");
                        verifyAdminAddress({
                          address_line1: formData.address,
                          postal_code: formData.zip,
                          city: formData.place,
                        })
                          .then((res) => {
                            const c = res?.normalized?.canton;
                            if (res?.valid && c != null && String(c).trim() !== "") {
                              const code = String(c).trim().toUpperCase();
                              setFormData((f) => ({ ...f, canton: code }));
                              setUnitCantonHint("Kanton automatisch erkannt.");
                            } else {
                              setUnitCantonHint(
                                "Kein Kanton automatisch ermittelbar. Bitte bei Bedarf manuell wählen."
                              );
                            }
                          })
                          .catch(() =>
                            setUnitCantonHint("Kanton konnte nicht automatisch ermittelt werden.")
                          )
                          .finally(() => setUnitAddrBusy(false));
                      }}
                      disabled={
                        saving ||
                        unitAddrBusy ||
                        !(String(formData.address || "").trim()) ||
                        !(String(formData.zip || "").trim()) ||
                        !(String(formData.place || "").trim())
                      }
                      className="self-start rounded-[8px] border border-black/10 dark:border-white/[0.1] bg-transparent px-3 py-2 text-xs font-semibold text-[#64748b] hover:bg-slate-100 dark:text-[#8090b0] dark:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {unitAddrBusy ? "…" : "Adresse prüfen"}
                    </button>
                    <p className="text-xs text-[#64748b] dark:text-[#6b7a9a]">
                      Öffnet Google Maps in einem neuen Tab. Der Kanton wird im Hintergrund ergänzt, wenn die
                      Abfrage einen Wert liefert.
                    </p>
                    {unitCantonHint ? (
                      <p className="text-xs text-[#64748b] dark:text-[#6b7a9a]">{unitCantonHint}</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                    Typ
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                  >
                    <option value="Apartment">Apartment</option>
                    <option value="Co-Living">Co-Living</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                    Liegenschaft (optional)
                  </label>
                  <select
                    name="property_id"
                    value={formData.property_id}
                    onChange={handleChange}
                    className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                  >
                    <option value="">— Nicht zugewiesen</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title || p.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                    Verwaltung (optional)
                  </label>
                  <input
                    type="search"
                    value={landlordFilter}
                    onChange={(e) => setLandlordFilter(e.target.value)}
                    placeholder="Suchen…"
                    className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-2 mb-2 text-sm text-[#0f172a] dark:text-[#eef2ff] outline-none"
                    autoComplete="off"
                  />
                  <select
                    name="landlord_id"
                    value={formData.landlord_id}
                    onChange={handleChange}
                    className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                  >
                    <option value="">— Keine Auswahl</option>
                    {filteredLandlordsForSelect.map((l) => (
                      <option key={l.id} value={l.id}>
                        {landlordSelectLabel(l)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                    Bewirtschafter (optional)
                  </label>
                  <input
                    type="search"
                    value={propertyManagerFilter}
                    onChange={(e) => setPropertyManagerFilter(e.target.value)}
                    placeholder="Suchen…"
                    className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-2 mb-2 text-sm text-[#0f172a] dark:text-[#eef2ff] outline-none"
                    autoComplete="off"
                  />
                  <select
                    name="property_manager_id"
                    value={formData.property_manager_id}
                    onChange={handleChange}
                    className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                  >
                    <option value="">— Keine Auswahl</option>
                    {filteredPropertyManagersForSelect.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {propertyManagerSelectLabel(pm)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                    Zimmer gesamt
                  </label>
                  {isCoLivingType ? (
                    <p className="mb-2 text-xs text-[#64748b] dark:text-[#6b7a9a]">
                      Zimmer-Details erscheinen, sobald «Zimmer gesamt» größer als 0 ist.
                    </p>
                  ) : null}
                  <input
                    type="number"
                    name="rooms"
                    value={formData.rooms}
                    onChange={handleChange}
                    required
                    placeholder="z. B. 3"
                    className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                  />
                </div>

                {isCoLivingType &&
                  !editingId &&
                  parsedRoomsTotal > 0 &&
                  coLivingRowsForDisplay.map((row, idx) => (
                    <div
                      key={idx}
                      className="md:col-span-2 rounded-[10px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] p-4"
                    >
                      <p className="mb-3 text-[13px] font-semibold text-[#0f172a] dark:text-[#eef2ff]">
                        Zimmer {idx + 1}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <label className="mb-1 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">Name</label>
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) =>
                              handleCoLivingRoomChange(idx, "name", e.target.value)
                            }
                            required
                            className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-3 py-2 text-sm text-[#0f172a] dark:text-[#eef2ff] outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                            Geplanter Zimmerpreis (CHF)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={row.price}
                            onChange={(e) =>
                              handleCoLivingRoomChange(idx, "price", e.target.value)
                            }
                            required
                            className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-3 py-2 text-sm text-[#0f172a] dark:text-[#eef2ff] outline-none"
                          />
                          <p className="mt-1 text-[11px] text-[#64748b] dark:text-[#6b7a9a]">
                            Wird für Prognosen und Vollbelegung verwendet
                          </p>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">Etage</label>
                          <input
                            type="number"
                            min="0"
                            value={row.floor}
                            onChange={(e) =>
                              handleCoLivingRoomChange(idx, "floor", e.target.value)
                            }
                            className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-3 py-2 text-sm text-[#0f172a] dark:text-[#eef2ff] outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">Fläche (m²)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.size_m2}
                            onChange={(e) =>
                              handleCoLivingRoomChange(idx, "size_m2", e.target.value)
                            }
                            className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-3 py-2 text-sm text-[#0f172a] dark:text-[#eef2ff] outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">Status</label>
                          <div className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-3 py-2 text-sm text-[#0f172a] dark:text-[#eef2ff]">
                            <span className="font-medium">Frei</span>
                            <span className="mt-0.5 block text-[11px] text-[#64748b] dark:text-[#6b7a9a]">
                              Wird automatisch berechnet
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                            Verfügbar ab
                          </label>
                          <input
                            type="date"
                            value={row.available_from ?? ""}
                            onChange={(e) =>
                              handleCoLivingRoomChange(
                                idx,
                                "available_from",
                                e.target.value
                              )
                            }
                            className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-3 py-2 text-sm text-[#0f172a] dark:text-[#eef2ff] outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                {isCoLivingType ? (
                  <div className="md:col-span-2">
                    <p className="rounded-[10px] border border-blue-500/[0.12] bg-blue-500/[0.06] px-4 py-3 text-xs text-[#7aaeff]">
                      Belegung der Einheit folgt aus Mietverhältnissen; Vorschau-KPI nutzt 0 belegte
                      Zimmer.
                    </p>
                  </div>
                ) : null}

                {!isCoLivingType ? (
                  <div>
                    <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                      Verfügbar ab
                    </label>
                    <input
                      type="date"
                      name="availableFrom"
                      value={formData.availableFrom}
                      onChange={handleChange}
                      required
                      className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                    />
                  </div>
                ) : null}

                {isCoLivingType ? (
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                        Monatliche geschätzte Einnahmen
                      </label>
                      <div
                        className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff]"
                        aria-readonly="true"
                      >
                        {formatCurrency(coLivingFullOccupancyRevenue)}
                        <span className="mt-1 block text-xs font-normal text-[#64748b] dark:text-[#6b7a9a]">
                          Summe der geplanten Zimmerpreise bei Vollbelegung
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                        Monatliche Gesamtkosten
                      </label>
                      <div
                        className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff]"
                        aria-readonly="true"
                      >
                        {formatCurrencyChf2(derivedMonthlyTotalCosts)}
                        <span className="mt-1 block text-xs font-normal text-[#64748b] dark:text-[#6b7a9a]">
                          Monatlich (voll) + jährlich (/12) + Kautionsversicherung (/12), einmalig ausgeschlossen.
                        </span>
                        {derivedOneTimeCostsTotal > 0 ? (
                          <span className="mt-1 block text-xs font-normal text-[#64748b] dark:text-[#6b7a9a]">
                            Einmalige Kosten gesamt: {formatCurrencyChf2(derivedOneTimeCostsTotal)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                      Monatliche Gesamtkosten
                    </label>
                    <div
                      className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff]"
                      aria-readonly="true"
                    >
                      {formatCurrencyChf2(derivedMonthlyTotalCosts)}
                          <span className="mt-1 block text-xs font-normal text-[#64748b] dark:text-[#6b7a9a]">
                        Monatlich (voll) + jährlich (/12) + Kautionsversicherung (/12), einmalig ausgeschlossen.
                      </span>
                      {derivedOneTimeCostsTotal > 0 ? (
                        <span className="mt-1 block text-xs font-normal text-[#64748b] dark:text-[#6b7a9a]">
                          Einmalige Kosten gesamt: {formatCurrencyChf2(derivedOneTimeCostsTotal)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}

                <div className="md:col-span-2 rounded-[10px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] p-4">
                  <p className="mb-3 text-[13px] font-semibold text-[#0f172a] dark:text-[#eef2ff]">
                    Kostenpositionen
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-[#0f172a] dark:text-[#eef2ff]">
                      <thead>
                        <tr className="border-b border-black/10 dark:border-white/[0.05] bg-slate-100 dark:bg-[#111520] text-[9px] font-bold uppercase tracking-[.8px] text-[#64748b] dark:text-[#6b7a9a]">
                          <th className="py-2 pr-4">Kostenart</th>
                          <th className="py-2 pr-4">Frequenz</th>
                          <th className="py-2 pr-4">Betrag (CHF)</th>
                          <th className="w-24 py-2 pr-4"> </th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalCostRows.map((row) => (
                          <tr key={row.id} className="border-b border-black/10 dark:border-white/[0.05] align-top">
                            <td className="py-2 pr-4">
                              <select
                                value={row.cost_type}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateModalCostRow(row.id, {
                                    cost_type: v,
                                    custom_type: v === "Sonstiges" ? row.custom_type : "",
                                  });
                                }}
                                disabled={saving}
                                className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none disabled:opacity-50"
                              >
                                <option value="">— wählen —</option>
                                {MODAL_COST_TYPE_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                              {row.cost_type === "Sonstiges" ? (
                                <input
                                  type="text"
                                  value={row.custom_type}
                                  onChange={(e) =>
                                    updateModalCostRow(row.id, {
                                      custom_type: e.target.value,
                                    })
                                  }
                                  disabled={saving}
                                  placeholder="Bezeichnung"
                                  className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none mt-2 disabled:opacity-50"
                                />
                              ) : null}
                            </td>
                            <td className="py-2 pr-4">
                              <select
                                value={row.frequency || "monthly"}
                                onChange={(e) =>
                                  updateModalCostRow(row.id, { frequency: e.target.value })
                                }
                                disabled={saving}
                                className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none disabled:opacity-50"
                              >
                                <option value="monthly">Monatlich</option>
                                <option value="yearly">Jährlich</option>
                                <option value="one_time">Einmalig</option>
                              </select>
                            </td>
                            <td className="py-2 pr-4">
                              <input
                                type="number"
                                value={row.amount_chf}
                                onChange={(e) =>
                                  updateModalCostRow(row.id, {
                                    amount_chf: e.target.value,
                                  })
                                }
                                disabled={saving}
                                className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none disabled:opacity-50"
                              />
                            </td>
                            <td className="py-2 pr-4">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => removeModalCostRow(row.id)}
                                className="text-sm font-medium text-[#f87171] hover:underline disabled:opacity-50"
                              >
                                Löschen
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={addModalCostRow}
                    className="mt-3 rounded-[8px] border border-black/10 dark:border-white/[0.1] bg-transparent px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-slate-100 dark:text-[#8090b0] dark:hover:bg-white/[0.04] disabled:opacity-50"
                  >
                    + Kostenart hinzufügen
                  </button>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                    Kautionsart Vermieter
                  </label>
                  <select
                    name="landlordDepositType"
                    value={formData.landlordDepositType}
                    onChange={handleChange}
                    className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                  >
                    <option value="">—</option>
                    <option value="bank">Bank</option>
                    <option value="insurance">Versicherung</option>
                    <option value="cash">Bar</option>
                    <option value="none">Keine</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                    Kautionsbetrag Vermieter
                  </label>
                  <input
                    type="number"
                    name="landlordDepositAmount"
                    value={formData.landlordDepositAmount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="z. B. 5000"
                    className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                  />
                </div>

                {formData.landlordDepositType === "insurance" ? (
                  <div>
                    <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                      Jahresprämie Vermieter
                    </label>
                    <input
                      type="number"
                      name="landlordDepositAnnualPremium"
                      value={formData.landlordDepositAnnualPremium}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      placeholder="z. B. 350"
                      className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                    />
                  </div>
                ) : null}

                <div className="md:col-span-2 mt-1 border-t border-black/10 dark:border-white/[0.05] pt-5">
                  <p className="mb-3 text-[13px] font-semibold text-[#0f172a] dark:text-[#eef2ff]">
                    Vertrag Vermieter
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                        Vertragsart
                      </label>
                      <select
                        name="leaseType"
                        value={formData.leaseType}
                        onChange={handleChange}
                        className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                      >
                        <option value="">—</option>
                        <option value="open_ended">Unbefristet</option>
                        <option value="fixed_term">Befristet</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                        Mietbeginn
                      </label>
                      <input
                        type="date"
                        name="leaseStartDate"
                        value={formData.leaseStartDate}
                        onChange={handleChange}
                        className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                      />
                    </div>

                    {formData.leaseType === "fixed_term" ? (
                      <div>
                        <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                          Vertragsende
                        </label>
                        <input
                          type="date"
                          name="leaseEndDate"
                          value={formData.leaseEndDate}
                          onChange={handleChange}
                          className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                        />
                      </div>
                    ) : null}

                    <div>
                      <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                        Kündigung eingereicht am
                      </label>
                      <input
                        type="date"
                        name="noticeGivenDate"
                        value={formData.noticeGivenDate}
                        onChange={handleChange}
                        className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                        Kündigung wirksam per
                      </label>
                      <input
                        type="date"
                        name="terminationEffectiveDate"
                        value={formData.terminationEffectiveDate}
                        onChange={handleChange}
                        className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                        Rückgabe erfolgt am
                      </label>
                      <input
                        type="date"
                        name="returnedToLandlordDate"
                        value={formData.returnedToLandlordDate}
                        onChange={handleChange}
                        className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                        Vertragsstatus
                      </label>
                      <div
                        className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff]"
                        aria-readonly="true"
                      >
                        {leaseStatusLabel(computeLeaseStatusKey(formData))}
                        <span className="mt-1 block text-xs font-normal text-[#64748b] dark:text-[#6b7a9a]">
                          Automatisch berechnet aus Mietbeginn / Kündigung / Rückgabe.
                        </span>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-[10px] text-[#64748b] dark:text-[#6b7a9a]">
                        Notizen
                      </label>
                      <textarea
                        name="leaseNotes"
                        value={formData.leaseNotes}
                        onChange={handleChange}
                        rows={3}
                        className="w-full rounded-[8px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] px-4 py-3 text-[#0f172a] dark:text-[#eef2ff] outline-none resize-y min-h-[5rem]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {!isCoLivingType ? (
                  <>
                    <div className="rounded-[10px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] p-4">
                      <p className="text-[11px] text-[#64748b] dark:text-[#6b7a9a]">Ziel-Mietpreis − Kosten (Stammdaten)</p>
                      <p className="mt-1 text-[24px] font-bold text-[#4ade80]">
                        {formatCurrency(currentApartmentProfit)}
                      </p>
                    </div>

                    <div className="rounded-[10px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] p-4">
                      <p className="text-[11px] text-[#64748b] dark:text-[#6b7a9a]">Zimmer</p>
                      <p className="mt-1 text-[24px] font-bold text-[#0f172a] dark:text-[#eef2ff]">
                        {formData.rooms || 0}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-[10px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] p-4">
                      <p className="text-[11px] text-[#64748b] dark:text-[#6b7a9a]">Einnahmen (Mieter-Äquivalent)</p>
                      <p className="mt-1 text-[24px] font-bold text-[#4ade80]">
                        {formatCurrency(currentCoLivingRevenue)}
                      </p>
                      <p className="mt-1 text-xs text-[#64748b] dark:text-[#6b7a9a]">
                        Aus TenancyRevenue-Äquivalent; kein Backend-KPI-Monat.
                      </p>
                    </div>

                    <div className="rounded-[10px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] p-4">
                      <p className="text-[11px] text-[#64748b] dark:text-[#6b7a9a]">Potenzial − Äquivalent</p>
                      <p className="mt-1 text-[24px] font-bold text-[#fb923c]">
                        {formatCurrency(currentCoLivingVacancy)}
                      </p>
                    </div>

                    <div className="rounded-[10px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] p-4">
                      <p className="text-[11px] text-[#64748b] dark:text-[#6b7a9a]">Deckungsbeitrag (Frontend)</p>
                      <p className="mt-1 text-[24px] font-bold text-[#4ade80]">
                        {formatCurrency(currentCoLivingProfit)}
                      </p>
                    </div>

                    <div className="rounded-[10px] border border-black/10 dark:border-white/[0.08] bg-slate-100 dark:bg-[#111520] p-4">
                      <p className="text-[11px] text-[#64748b] dark:text-[#6b7a9a]">Freie Zimmer</p>
                      <p className="mt-1 text-[24px] font-bold text-[#0f172a] dark:text-[#eef2ff]">
                        {currentFreeRooms}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {!formLeaseStarted && (
                <div className="mt-4 rounded-[10px] border border-amber-500/[0.15] bg-amber-500/[0.06] p-4">
                  <p className="text-sm text-[#fbbf24]">
                    Hinweis: Der Mietbeginn im Vertrag Vermieter liegt in der Zukunft.
                    Deshalb werden die aktuellen KPI noch ohne laufende Monatskosten gerechnet.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-[8px] border border-black/10 dark:border-white/[0.1] bg-transparent px-5 py-3 font-semibold text-[#64748b] hover:bg-slate-100 dark:text-[#8090b0] dark:hover:bg-white/[0.04]"
                >
                  Abbrechen
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-[8px] border-none bg-gradient-to-r from-[#5b8cff] to-[#7c5cfc] px-5 py-3 font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Speichern …" : editingId ? "Änderungen speichern" : "Unit speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminApartmentsPage;