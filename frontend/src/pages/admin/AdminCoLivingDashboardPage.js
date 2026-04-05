import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { API_BASE_URL, getApiHeaders } from "../../config";
import {
  fetchAdminUnits,
  fetchAdminRooms,
  fetchAdminOccupancy,
  fetchAdminOccupancyRooms,
  fetchAdminProfit,
  fetchAdminTenanciesAll,
  normalizeUnit,
  normalizeRoom,
} from "../../api/adminData";
import {
  getRoomOccupancyStatus,
  parseIsoDate,
  tenanciesForRoom,
} from "../../utils/unitOccupancyStatus";

function sumFilteredProfitField(profitResponse, filteredUnits, field) {
  if (!profitResponse?.units || !Array.isArray(profitResponse.units)) return null;
  const allowed = new Set(
    filteredUnits.map((u) => String(u.id ?? u.unitId))
  );
  let sum = 0;
  for (const row of profitResponse.units) {
    if (allowed.has(String(row.unit_id))) {
      sum += Number(row[field] ?? 0);
    }
  }
  return sum;
}

function profitRowsByUnitId(profitResponse) {
  const m = new Map();
  if (!profitResponse?.units) return m;
  for (const row of profitResponse.units) {
    m.set(String(row.unit_id), row);
  }
  return m;
}

/** Sum GET /api/admin/occupancy `units[]` rows whose unit_id is in filtered Co-Living units (same scope as the page). */
function aggregateOccupancyForFilter(occupancyApi, filteredUnits) {
  if (!occupancyApi?.units || !Array.isArray(occupancyApi.units)) return null;
  const allowed = new Set(
    filteredUnits.map((u) => String(u.id ?? u.unitId))
  );
  let totalRooms = 0;
  let occupiedRooms = 0;
  let reservedRooms = 0;
  let freeRooms = 0;
  for (const row of occupancyApi.units) {
    if (!allowed.has(String(row.unit_id))) continue;
    totalRooms += Number(row.total_rooms ?? 0);
    occupiedRooms += Number(row.occupied_rooms ?? 0);
    reservedRooms += Number(row.reserved_rooms ?? 0);
    freeRooms += Number(row.free_rooms ?? 0);
  }
  const occupiedRate =
    totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
  const reservedRate =
    totalRooms > 0 ? (reservedRooms / totalRooms) * 100 : 0;
  const freeRate = totalRooms > 0 ? (freeRooms / totalRooms) * 100 : 0;
  const round1 = (n) => Math.round(n * 10) / 10;
  return {
    totalRooms,
    occupiedRooms,
    reservedRooms,
    freeRooms,
    occupiedRate: round1(occupiedRate),
    reservedRate: round1(reservedRate),
    freeRate: round1(freeRate),
  };
}

function roundCurrency(value) {
  return Math.round(Number(value || 0));
}

function formatCurrency(value) {
  return `CHF ${roundCurrency(value).toLocaleString("de-CH")}`;
}

function formatChfOrDash(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return formatCurrency(value);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

function getSelectedMonthDate(selectedPeriod, selectedMonth) {
  const today = new Date();

  if (selectedPeriod === "lastMonth") {
    return new Date(today.getFullYear(), today.getMonth() - 1, 1);
  }

  if (selectedPeriod === "thisMonth") {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  if (selectedPeriod === "nextMonth") {
    return new Date(today.getFullYear(), today.getMonth() + 1, 1);
  }

  if (selectedPeriod === "customMonth" && selectedMonth) {
    const [year, month] = selectedMonth.split("-");
    return new Date(Number(year), Number(month) - 1, 1);
  }

  return new Date(today.getFullYear(), today.getMonth(), 1);
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function hasLeaseStarted(unit) {
  const c = String(unit?.leaseStartDate ?? unit?.lease_start_date ?? "").trim();
  if (c && /^\d{4}-\d{2}-\d{2}/.test(c)) {
    return c.slice(0, 10) <= getTodayDateString();
  }
  const af = String(unit?.availableFrom ?? "").trim();
  if (af && /^\d{4}-\d{2}-\d{2}/.test(af)) {
    return af.slice(0, 10) <= getTodayDateString();
  }
  return false;
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getRoomsForUnit(unitId, allRooms = []) {
  return allRooms.filter((room) => (room.unitId || room.unit_id) === unitId);
}

function toIsoDay(d) {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tenancyOverlapsMonth(t, monthStart, monthEnd) {
  const moveIn = parseIsoDate(t?.move_in_date);
  if (!moveIn) return false;
  const moveOut = t.move_out_date ? parseIsoDate(t.move_out_date) : null;
  const end = moveOut || "9999-12-31";
  const ms = toIsoDay(monthStart);
  const me = toIsoDay(monthEnd);
  if (!ms || !me) return false;
  return moveIn <= me && end >= ms;
}

function normalizeTenancyStatusLocal(t) {
  return String(t?.status ?? "").trim().toLowerCase();
}

/** Current month: getRoomOccupancyStatus. Other months: overlap + active / reserved / ended only; else frei. */
function roomOccupancyKindForMonth(room, tenancies, monthStart, monthEnd, isCurrentMonth) {
  if (isCurrentMonth) {
    return getRoomOccupancyStatus(room, tenancies) || "frei";
  }
  const roomT = tenanciesForRoom(room, tenancies || []).filter((t) =>
    tenancyOverlapsMonth(t, monthStart, monthEnd)
  );
  if (roomT.length === 0) return "frei";
  if (roomT.some((t) => normalizeTenancyStatusLocal(t) === "active")) return "belegt";
  if (roomT.some((t) => normalizeTenancyStatusLocal(t) === "reserved")) return "reserviert";
  if (roomT.some((t) => normalizeTenancyStatusLocal(t) === "ended")) return "belegt";
  return "frei";
}

function getCoLivingMetricsForMonth(unit, activeMonth, allRooms = [], tenancies = []) {
  const rooms = getRoomsForUnit(unit.unitId || unit.id, allRooms);
  const monthStart = getMonthStart(activeMonth);
  const monthEnd = getMonthEnd(activeMonth);
  const leaseStarted = hasLeaseStarted(unit);
  const now = new Date();
  const isCurrentMonth =
    activeMonth.getFullYear() === now.getFullYear() &&
    activeMonth.getMonth() === now.getMonth();

  if (rooms.length === 0) {
    const total = Number(unit.rooms || 0);

    return {
      occupiedCount: 0,
      reservedCount: 0,
      freeCount: total,
      totalRooms: total,
      fullRevenue: null,
      currentRevenue: null,
      vacancyLoss: null,
      currentProfit: null,
      runningCosts: null,
      isFullyOccupied: false,
      isPartiallyOccupied: false,
      leaseStarted,
    };
  }

  let occupiedCount = 0;
  let reservedCount = 0;
  let freeCount = 0;
  for (const room of rooms) {
    const kind = roomOccupancyKindForMonth(
      room,
      tenancies,
      monthStart,
      monthEnd,
      isCurrentMonth
    );
    if (kind === "belegt") occupiedCount += 1;
    else if (kind === "reserviert") reservedCount += 1;
    else freeCount += 1;
  }

  return {
    occupiedCount,
    reservedCount,
    freeCount,
    totalRooms: rooms.length,
    fullRevenue: null,
    currentRevenue: null,
    vacancyLoss: null,
    currentProfit: null,
    runningCosts: null,
    isFullyOccupied:
      rooms.length > 0 && occupiedCount === rooms.length,
    isPartiallyOccupied:
      occupiedCount > 0 && occupiedCount < rooms.length,
    leaseStarted,
  };
}

function buildWarnings(units, rankedUnits, profitByUnitId) {
  const warnings = [];

  rankedUnits.forEach((unit) => {
    const uid = String(unit.internalUnitId ?? "");
    const prow = uid ? profitByUnitId.get(uid) : null;
    const rev = prow != null ? Number(prow.revenue) : null;
    const prof = prow != null ? Number(prow.profit) : null;

    if (rev != null && rev <= 0) {
      warnings.push({
        type: "danger",
        title: `${unit.unitId} · ${unit.place}`,
        text: "Keine aktuellen Einnahmen vorhanden.",
      });
    }

    if (prof != null && prof < 0) {
      warnings.push({
        type: "danger",
        title: `${unit.unitId} · ${unit.place}`,
        text: `Unter Break-Even um ${formatCurrency(Math.abs(prof))}.`,
      });
    }

    if (unit.freeCount > 0) {
      warnings.push({
        type: "warning",
        title: `${unit.unitId} · ${unit.place}`,
        text: `${unit.freeCount} freie Rooms ohne aktuelle Belegung.`,
      });
    }
  });

  units.forEach((unit) => {
    if (!hasLeaseStarted(unit)) {
      const uid = String(unit.id ?? unit.unitId);
      const prow = profitByUnitId.get(uid);
      const rev = prow != null ? Number(prow.revenue) : null;
      if (rev != null && rev <= 0) {
        warnings.push({
          type: "danger",
          title: `${unit.unitId} · ${unit.place}`,
          text: "Mietstart Vermieter liegt in der Zukunft und aktuell ist noch kein Umsatz gesichert.",
        });
      }
    }
  });

  return warnings.slice(0, 6);
}

/** Design-token KPI tile (Live / Forecast). */
function HeroCard({
  title,
  value,
  subtitle,
  accent: _accent,
  trend = null,
  children = null,
}) {
  const cfgByTitle = {
    "Aktueller Umsatz": { bar: "#3ddc84", valueClass: "text-[20px] text-[#3ddc84]", tag: "live" },
    "Gewinn aktuell": { bar: "#3ddc84", valueClass: "text-[20px] text-[#3ddc84]", tag: "live" },
    "Mögliche Ausgaben": { bar: "#f5a623", valueClass: "text-[20px] text-[#f5a623]", tag: "live" },
    "Belegt in %": { bar: "#5b9cf6", valueClass: "text-[20px] text-[#5b9cf6]", tag: "live" },
    "Forecast Umsatz": { bar: "#5b9cf6", valueClass: "text-[20px] text-[#5b9cf6]", tag: "forecast" },
    "Forecast Gewinn": { bar: "#3ddc84", valueClass: "text-[20px] text-[#3ddc84]", tag: "forecast" },
    "Forecast Reserve": { bar: "#f5a623", valueClass: "text-[20px] text-[#f5a623]", tag: "forecast" },
    "Forecast Belegung %": { bar: "#5b9cf6", valueClass: "text-[20px] text-[#5b9cf6]", tag: "forecast" },
    "Kritische Units": { bar: "#ff5f6d", valueClass: "text-[20px] text-[#ff5f6d]", tag: "forecast" },
  };
  const cfg = cfgByTitle[title] || {
    bar: "#f5a623",
    valueClass: "text-[20px] text-[#edf0f7]",
    tag: "live",
  };
  const tagCls =
    cfg.tag === "forecast"
      ? "border border-[rgba(91,156,246,0.25)] bg-[rgba(91,156,246,0.12)] text-[#5b9cf6]"
      : "border border-[rgba(61,220,132,0.25)] bg-[rgba(61,220,132,0.12)] text-[#3ddc84]";

  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[#1c2035] bg-[#10121a] p-[13px_15px] transition-colors hover:border-[#242840]">
      <div
        className="absolute left-0 right-0 top-0 h-[2px] rounded-t-[10px]"
        style={{ background: cfg.bar }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.5px] text-[#4a5070]">{title}</p>
          <p className={`mb-[4px] font-mono font-medium leading-none ${cfg.valueClass}`}>{value}</p>
          <p className="text-[10px] leading-[1.4] text-[#4a5070]">{subtitle}</p>
          {children}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-[6px] py-[2px] text-[9px] font-semibold uppercase tracking-[0.4px] ${tagCls}`}>
            {cfg.tag === "forecast" ? "Forecast" : "Live"}
          </span>
          {trend ? (
            <span
              className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${
                trend.positive
                  ? "border-[rgba(61,220,132,0.25)] bg-[rgba(61,220,132,0.1)] text-[#3ddc84]"
                  : "border-[rgba(255,95,109,0.25)] bg-[rgba(255,95,109,0.1)] text-[#ff5f6d]"
              }`}
            >
              {trend.label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, rightSlot = null }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[#1c2035] bg-[#10121a]">
      <div className="flex items-start justify-between gap-3 border-b border-[#1c2035] px-[16px] py-[13px]">
        <div className="min-w-0">
          <h3 className="text-[13px] font-medium text-[#edf0f7]">{title}</h3>
          {subtitle ? (
            <p className="mt-[2px] text-[10px] text-[#4a5070]">{subtitle}</p>
          ) : null}
        </div>
        {rightSlot}
      </div>
      <div className="px-[14px] py-[12px]">{children}</div>
    </div>
  );
}

function SmallStatCard({ label, value, hint, valueClassName = "text-[#edf0f7]" }) {
  return (
    <div className="rounded-[8px] bg-[#141720] p-[10px_12px]">
      <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.5px] text-[#4a5070]">{label}</p>
      <p className={`font-mono text-[16px] font-medium ${valueClassName}`}>{value}</p>
      {hint ? <p className="mt-[3px] text-[9px] leading-[1.4] text-[#4a5070]">{hint}</p> : null}
    </div>
  );
}

function ProgressRow({
  label,
  value,
  count,
  colorClass,
  labelClass = "text-[#3ddc84]",
  pctClass = "text-[#3ddc84]",
  badgeClass = "border-[rgba(61,220,132,0.2)] bg-[rgba(61,220,132,0.12)] text-[#3ddc84]",
}) {
  const safeValue = Math.max(0, Math.min(Number(value || 0), 100));

  return (
    <div className="flex items-center gap-[10px] border-b border-[#1c2035] py-[7px] last:border-b-0">
      <p className={`w-[80px] shrink-0 text-[11px] ${labelClass}`}>{label}</p>
      <span
        className={`mr-[4px] rounded-[4px] px-[6px] py-[1px] text-[9px] font-semibold ${badgeClass}`}
      >
        {count}
      </span>
      <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-[#191c28]">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${safeValue}%` }} />
      </div>
      <p className={`w-[42px] shrink-0 text-right font-mono text-[11px] ${pctClass}`}>
        {formatPercent(safeValue)}
      </p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <div className="flex min-w-[160px] flex-col gap-[3px]">
      <label className="text-[9px] font-medium uppercase tracking-[0.5px] text-[#4a5070]">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="w-full cursor-pointer appearance-none rounded-[6px] border border-[#1c2035] bg-[#141720] px-[10px] py-[5px] font-['DM_Sans'] text-[12px] text-[#edf0f7] outline-none"
      >
        {children}
      </select>
    </div>
  );
}

function getTrendLabel(current, previous) {
  if (!previous || previous === 0) return { label: "Neu", positive: true };
  const diff = ((current - previous) / previous) * 100;
  const sign = diff >= 0 ? "+" : "";
  return {
    label: `${sign}${diff.toFixed(1)}% vs. Vormonat`,
    positive: diff >= 0,
  };
}

function AdminCoLivingDashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("thisMonth");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedPlace, setSelectedPlace] = useState("all");
  const [selectedUnitId, setSelectedUnitId] = useState("all");
  const [period, setPeriod] = useState("month");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/invoices`, { headers: getApiHeaders() }).catch((err) => {
      console.error("Error loading invoices:", err);
    });
  }, []);

  const activeMonth = useMemo(() => {
    return getSelectedMonthDate(selectedPeriod, selectedMonth);
  }, [selectedPeriod, selectedMonth]);

  const [units, setUnits] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenancies, setTenancies] = useState([]);
  const [occupancyApi, setOccupancyApi] = useState(null);
  const [occupancyRoomsMap, setOccupancyRoomsMap] = useState(null);
  const [profitSixMonth, setProfitSixMonth] = useState(null);
  const [profitSixMonthLoading, setProfitSixMonthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const periods = Array.from({ length: 6 }, (_, index) => {
      const d = addMonths(startOfMonth(activeMonth), index - 2);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
    setProfitSixMonthLoading(true);
    Promise.all(
      periods.map((p) => fetchAdminProfit(p).catch(() => null))
    )
      .then((arr) => {
        if (!cancelled) setProfitSixMonth(arr);
      })
      .finally(() => {
        if (!cancelled) setProfitSixMonthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeMonth]);

  useEffect(() => {
    fetchAdminUnits()
      .then((data) => setUnits(Array.isArray(data) ? data.map(normalizeUnit) : []))
      .catch(() => setUnits([]));
    fetchAdminRooms()
      .then((data) => setRooms(Array.isArray(data) ? data.map(normalizeRoom) : []))
      .catch(() => setRooms([]));
    fetchAdminTenanciesAll()
      .then((data) => setTenancies(Array.isArray(data) ? data : []))
      .catch(() => setTenancies([]));
    fetchAdminOccupancy()
      .then((data) => setOccupancyApi(data))
      .catch(() => setOccupancyApi(null));
  }, []);

  const allCoLivingUnits = useMemo(() => {
    return units.filter((unit) => unit.type === "Co-Living");
  }, [units]);

  const placeOptions = useMemo(() => {
    const places = [
      ...new Set(allCoLivingUnits.map((unit) => unit.place).filter(Boolean)),
    ];
    return places.sort((a, b) => a.localeCompare(b));
  }, [allCoLivingUnits]);

  const filteredUnits = useMemo(() => {
    return allCoLivingUnits.filter((unit) => {
      const placeOk = selectedPlace === "all" || unit.place === selectedPlace;
      const unitOk = selectedUnitId === "all" || unit.unitId === selectedUnitId;
      return placeOk && unitOk;
    });
  }, [allCoLivingUnits, selectedPlace, selectedUnitId]);

  const firstFilteredUnit = useMemo(() => filteredUnits[0], [filteredUnits]);
  useEffect(() => {
    if (!firstFilteredUnit) {
      setOccupancyRoomsMap(null);
      return;
    }
    const uid = firstFilteredUnit.id ?? firstFilteredUnit.unitId;
    if (!uid) return;
    const onDate = new Date().toISOString().slice(0, 10);
    fetchAdminOccupancyRooms({ unit_id: uid, on_date: onDate })
      .then((data) => setOccupancyRoomsMap(data))
      .catch(() => setOccupancyRoomsMap(null));
  }, [firstFilteredUnit]);

  const profitForActiveMonth = useMemo(
    () => (profitSixMonth?.length === 6 ? profitSixMonth[2] : null),
    [profitSixMonth]
  );

  const profitByUnitIdActive = useMemo(
    () => profitRowsByUnitId(profitForActiveMonth),
    [profitForActiveMonth]
  );

  /** Aktueller Monat (Index 2): Backend-Umsatz, gefiltert. */
  const heroCurrentRevenueBackend = useMemo(() => {
    if (profitSixMonthLoading) return null;
    return sumFilteredProfitField(profitSixMonth?.[2], filteredUnits, "revenue");
  }, [profitSixMonth, profitSixMonthLoading, filteredUnits]);

  const dashboard = useMemo(() => {
    const totals = {
      unitsCount: filteredUnits.length,
      totalRooms: 0,
      occupiedRooms: 0,
      reservedRooms: 0,
      freeRooms: 0,
      fullRevenue: null,
      currentRevenue: null,
      runningCosts: null,
      vacancyLoss: null,
      currentProfit: null,
      fullUnits: 0,
      partialUnits: 0,
      notStartedUnits: 0,
      vacancyDays: null,
      lostRevenue7Days: null,
    };

    let totalRev = 0;
    let totalCost = 0;
    let totalProf = 0;

    const unitPerformance = filteredUnits.map((unit) => {
      const metrics = getCoLivingMetricsForMonth(unit, activeMonth, rooms, tenancies);
      const uid = String(unit.id ?? unit.unitId);
      const prow = profitByUnitIdActive.get(uid);
      const currentRevenue = prow != null ? Number(prow.revenue) : null;
      const currentProfit = prow != null ? Number(prow.profit) : null;
      const runningCosts = prow != null ? Number(prow.costs) : null;

      if (prow != null) {
        totalRev += Number(prow.revenue);
        totalCost += Number(prow.costs);
        totalProf += Number(prow.profit);
      }

      const occupancyRate =
        metrics.totalRooms > 0
          ? (metrics.occupiedCount / metrics.totalRooms) * 100
          : 0;

      totals.totalRooms += metrics.totalRooms;
      totals.occupiedRooms += metrics.occupiedCount;
      totals.reservedRooms += metrics.reservedCount;
      totals.freeRooms += metrics.freeCount;

      if (metrics.isFullyOccupied) totals.fullUnits += 1;
      if (metrics.isPartiallyOccupied) totals.partialUnits += 1;
      if (!metrics.leaseStarted) totals.notStartedUnits += 1;

      return {
        unitId: unit.unitId,
        internalUnitId: uid,
        place: unit.place,
        totalRooms: metrics.totalRooms,
        occupiedCount: metrics.occupiedCount,
        reservedCount: metrics.reservedCount,
        freeCount: metrics.freeCount,
        occupancyRate,
        currentRevenue,
        currentProfit,
        vacancyLoss: null,
        runningCosts,
        fullRevenue: null,
        breakEvenRevenue: runningCosts,
        breakEvenGap:
          currentRevenue != null && runningCosts != null
            ? currentRevenue - runningCosts
            : null,
        vacancyDays: null,
        lostRevenue7Days: null,
      };
    });

    totals.currentRevenue =
      profitForActiveMonth != null ? totalRev : null;
    totals.runningCosts =
      profitForActiveMonth != null ? totalCost : null;
    totals.currentProfit =
      profitForActiveMonth != null ? totalProf : null;

    const occupiedRate =
      totals.totalRooms > 0
        ? (totals.occupiedRooms / totals.totalRooms) * 100
        : 0;
    const reservedRate =
      totals.totalRooms > 0
        ? (totals.reservedRooms / totals.totalRooms) * 100
        : 0;
    const freeRate =
      totals.totalRooms > 0 ? (totals.freeRooms / totals.totalRooms) * 100 : 0;

    const averageRevenuePerRoom =
      totals.totalRooms > 0 && totals.currentRevenue != null
        ? totals.currentRevenue / totals.totalRooms
        : null;
    const averageProfitPerUnit =
      filteredUnits.length > 0 && totals.currentProfit != null
        ? totals.currentProfit / filteredUnits.length
        : null;

    const rankedUnits = [...unitPerformance].sort((a, b) => {
      const br = b.currentRevenue ?? -Infinity;
      const ar = a.currentRevenue ?? -Infinity;
      return br - ar;
    });
    const bestUnit = rankedUnits.length > 0 ? rankedUnits[0] : null;
    const worstUnit =
      rankedUnits.length > 0 ? rankedUnits[rankedUnits.length - 1] : null;

    return {
      ...totals,
      occupiedRate,
      reservedRate,
      freeRate,
      averageRevenuePerRoom,
      averageProfitPerUnit,
      rankedUnits,
      bestUnit,
      worstUnit,
    };
  }, [
    filteredUnits,
    activeMonth,
    rooms,
    tenancies,
    profitByUnitIdActive,
    profitForActiveMonth,
  ]);

  const dashboardDisplay = useMemo(() => {
    const base = dashboard;
    const agg = aggregateOccupancyForFilter(occupancyApi, filteredUnits);
    if (agg == null) return base;
    return {
      ...base,
      totalRooms: agg.totalRooms,
      occupiedRooms: agg.occupiedRooms,
      reservedRooms: agg.reservedRooms,
      freeRooms: agg.freeRooms,
      occupiedRate: agg.occupiedRate,
      reservedRate: agg.reservedRate,
      freeRate: agg.freeRate,
    };
  }, [dashboard, occupancyApi, filteredUnits]);

  const forecast = useMemo(() => {
    if (!profitForActiveMonth?.units) {
      return {
        forecastRevenue: null,
        forecastCosts: null,
        forecastProfit: null,
        expectedOccupancyRate: 0,
        criticalUnits: 0,
      };
    }
    const forecastRevenue = sumFilteredProfitField(
      profitForActiveMonth,
      filteredUnits,
      "revenue"
    );
    const forecastCosts = sumFilteredProfitField(
      profitForActiveMonth,
      filteredUnits,
      "costs"
    );
    const forecastProfit = sumFilteredProfitField(
      profitForActiveMonth,
      filteredUnits,
      "profit"
    );
    let criticalUnits = 0;
    const allowed = new Set(
      filteredUnits.map((u) => String(u.id ?? u.unitId))
    );
    for (const row of profitForActiveMonth.units) {
      if (!allowed.has(String(row.unit_id))) continue;
      if (Number(row.profit) < 0) criticalUnits += 1;
    }
    const expectedOccupancyRate = dashboardDisplay.occupiedRate;

    return {
      forecastRevenue,
      forecastCosts,
      forecastProfit,
      expectedOccupancyRate,
      criticalUnits,
    };
  }, [profitForActiveMonth, filteredUnits, dashboardDisplay.occupiedRate]);

  const monthlyRevenueForecast = useMemo(() => {
    if (!profitSixMonth || profitSixMonth.length !== 6) {
      return Array.from({ length: 6 }, (_, index) => {
        const monthDate = addMonths(startOfMonth(activeMonth), index - 2);
        return {
          month: monthDate.toLocaleDateString("de-CH", { month: "short" }),
          secureRevenue: null,
          reservedRevenue: 0,
          riskRevenue: 0,
          freeRevenue: 0,
          forecastRevenue: null,
        };
      });
    }
    return profitSixMonth.map((profitData, index) => {
      const monthDate = addMonths(startOfMonth(activeMonth), index - 2);
      const total = sumFilteredProfitField(profitData, filteredUnits, "revenue");
      return {
        month: monthDate.toLocaleDateString("de-CH", { month: "short" }),
        secureRevenue: total,
        reservedRevenue: 0,
        riskRevenue: 0,
        freeRevenue: 0,
        forecastRevenue: total,
      };
    });
  }, [profitSixMonth, activeMonth, filteredUnits]);

  const dashboardWarnings = useMemo(() => {
    return buildWarnings(
      filteredUnits,
      dashboard.rankedUnits,
      profitByUnitIdActive
    );
  }, [filteredUnits, dashboard.rankedUnits, profitByUnitIdActive]);

  const roomStatusChartData = [
    { name: "Belegt", value: dashboardDisplay.occupiedRooms },
    { name: "Reserviert", value: dashboardDisplay.reservedRooms },
    { name: "Frei", value: dashboardDisplay.freeRooms },
  ];

  const monthlyChartData = useMemo(() => {
    if (!profitSixMonth || profitSixMonth.length !== 6) {
      return Array.from({ length: 6 }, (_, index) => {
        const monthDate = addMonths(startOfMonth(activeMonth), index - 2);
        return {
          month: monthDate.toLocaleDateString("de-CH", { month: "short" }),
          umsatz: null,
        };
      });
    }
    return profitSixMonth.map((profitData, index) => {
      const monthDate = addMonths(startOfMonth(activeMonth), index - 2);
      return {
        month: monthDate.toLocaleDateString("de-CH", { month: "short" }),
        umsatz: sumFilteredProfitField(profitData, filteredUnits, "revenue"),
      };
    });
  }, [profitSixMonth, activeMonth, filteredUnits]);

  const revenueTrend = getTrendLabel(
    monthlyChartData[5]?.umsatz ?? 0,
    monthlyChartData[4]?.umsatz ?? 0
  );

  const profitTrend = null;

  const costTrend = null;

  const occupancyTrend = null;

  return (
    <div className="min-h-screen bg-[#080a0f] text-[#edf0f7]">
      <header className="sticky top-0 z-30 flex h-[50px] items-center justify-between border-b border-[#1c2035] bg-[#0c0e15] px-6 backdrop-blur-md">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="text-[14px] font-semibold text-[#edf0f7]">
            Van<span className="text-[#5b9cf6]">tio</span>
          </span>
          <span className="text-[#4a5070]">·</span>
          <span className="truncate text-[14px] font-medium text-[#edf0f7]">Co-Living Dashboard</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="appearance-none rounded-[6px] border border-[#1c2035] bg-[#141720] px-3 py-1 font-mono text-[12px] text-[#edf0f7] outline-none"
          >
            <option value="month">Dieser Monat</option>
            <option value="lastMonth">Letzter Monat</option>
            <option value="year">Dieses Jahr</option>
            <option value="all">Alle Zeit</option>
          </select>
          <span className="rounded-[6px] border border-[#1c2035] bg-[#141720] px-3 py-1 text-[11px] text-[#8892b0]">
            Live API
          </span>
          <span className="inline-flex cursor-default items-center rounded-[6px] border border-[rgba(91,156,246,0.28)] bg-[rgba(91,156,246,0.1)] px-[14px] py-[5px] text-[11px] font-medium text-[#5b9cf6]">
            Co-Einzug
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] space-y-5 px-6 py-5">
        {activeMonth > startOfMonth(new Date()) && (
          <div className="rounded-[10px] border border-[rgba(245,166,35,0.2)] bg-[rgba(245,166,35,0.06)] px-4 py-3 text-[13px] text-[#f5a623]">
            Zukunftsmonat gewählt: Diese Werte sind eine Prognose auf Basis aktueller Belegungen,
            Reservierungen und bekannter Kosten.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-[12px] rounded-[10px] border border-[#1c2035] bg-[#10121a] px-[16px] py-[12px]">
          <FilterSelect
            label="Zeitraum"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="lastMonth">Letzter Monat</option>
            <option value="thisMonth">Dieser Monat</option>
            <option value="nextMonth">Nächster Monat</option>
            <option value="customMonth">Monat auswählen</option>
          </FilterSelect>

          {selectedPeriod === "customMonth" && (
            <>
              <div className="hidden h-[32px] w-px bg-[#1c2035] sm:block" />
              <FilterSelect
                label="Monat"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="">Monat wählen</option>
                <option value="2026-01">Jan 2026</option>
                <option value="2026-02">Feb 2026</option>
                <option value="2026-03">Mär 2026</option>
                <option value="2026-04">Apr 2026</option>
                <option value="2026-05">Mai 2026</option>
                <option value="2026-06">Jun 2026</option>
                <option value="2026-07">Jul 2026</option>
                <option value="2026-08">Aug 2026</option>
                <option value="2026-09">Sep 2026</option>
                <option value="2026-10">Okt 2026</option>
                <option value="2026-11">Nov 2026</option>
                <option value="2026-12">Dez 2026</option>
              </FilterSelect>
            </>
          )}

          <div className="hidden h-[32px] w-px bg-[#1c2035] md:block" />

          <FilterSelect
            label="Ort"
            value={selectedPlace}
            onChange={(e) => {
              setSelectedPlace(e.target.value);
              setSelectedUnitId("all");
            }}
          >
            <option value="all">Alle Orte</option>
            {placeOptions.map((place) => (
              <option key={place} value={place}>
                {place}
              </option>
            ))}
          </FilterSelect>

          <div className="hidden h-[32px] w-px bg-[#1c2035] lg:block" />

          <FilterSelect
            label="Unit"
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
          >
            <option value="all">Alle Units</option>
            {allCoLivingUnits
              .filter((unit) => selectedPlace === "all" || unit.place === selectedPlace)
              .map((unit) => (
                <option key={unit.unitId} value={unit.unitId}>
                  {unit.unitId}
                </option>
              ))}
          </FilterSelect>

          <div className="ml-auto flex items-center gap-[6px]">
            <span className="h-[6px] w-[6px] rounded-full bg-[#3ddc84]" />
            <span className="text-[11px] text-[#4a5070]">Live</span>
          </div>
        </div>

        <div className="mb-[10px] flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.8px] text-[#4a5070]">Aktuell · Live</span>
          <div className="h-px flex-1 bg-[#1c2035]" />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <HeroCard
            title="Aktueller Umsatz"
            value={formatChfOrDash(heroCurrentRevenueBackend)}
            subtitle="Prorierter Mietumsatz (Backend) für den gewählten Monat"
            accent="orange"
            trend={revenueTrend}
          >
            <div className="mt-[10px] flex gap-[6px] border-t border-[#1c2035] pt-[10px]">
              <span className="rounded-[6px] border border-[rgba(61,220,132,0.2)] bg-[rgba(61,220,132,0.1)] px-2 py-[2px] text-[9px] font-semibold text-[#3ddc84]">
                Belegt {dashboardDisplay.occupiedRooms}
              </span>
              <span className="rounded-[6px] border border-[rgba(245,166,35,0.2)] bg-[rgba(245,166,35,0.1)] px-2 py-[2px] text-[9px] font-semibold text-[#f5a623]">
                Reserviert {dashboardDisplay.reservedRooms}
              </span>
            </div>
          </HeroCard>
          <HeroCard
            title="Gewinn aktuell"
            value={formatChfOrDash(dashboard.currentProfit)}
            subtitle="Umsatz minus laufende Ausgaben"
            accent="green"
            trend={profitTrend}
          />
          <HeroCard
            title="Mögliche Ausgaben"
            value={formatChfOrDash(dashboard.runningCosts)}
            subtitle="Miete an Vermieter, Nebenkosten und Reinigung"
            accent="slate"
            trend={costTrend}
          />
          <HeroCard
            title="Belegt in %"
            value={formatPercent(dashboardDisplay.occupiedRate)}
            subtitle="Aktuelle Auslastung über alle Rooms"
            accent="rose"
            trend={occupancyTrend}
          >
            <div className="mt-[8px] mb-[4px] h-[3px] rounded-full bg-[#191c28]">
              <div
                className="h-full rounded-full bg-[#5b9cf6]"
                style={{ width: `${Math.min(100, Math.max(0, Number(dashboardDisplay.occupiedRate) || 0))}%` }}
              />
            </div>
            <p className="text-[10px] text-[#5b9cf6]">Auslastung</p>
          </HeroCard>
        </div>

        <div className="mb-[10px] flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.8px] text-[#4a5070]">Forecast · Hochrechnung</span>
          <div className="h-px flex-1 bg-[#1c2035]" />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <HeroCard
            title="Forecast Umsatz"
            value={formatChfOrDash(forecast.forecastRevenue)}
            subtitle="Erwarteter Umsatz im gewählten Zeitraum"
            accent="blue"
          />
          <HeroCard
            title="Forecast Gewinn"
            value={formatChfOrDash(forecast.forecastProfit)}
            subtitle="Erwarteter Gewinn nach Kosten"
            accent="green"
          />
          <HeroCard
            title="Forecast Reserve"
            value={formatChfOrDash(forecast.forecastCosts)}
            subtitle="Erwartete laufende Kosten im gewählten Zeitraum"
            accent="slate"
          />
          <HeroCard
            title="Forecast Belegung %"
            value={formatPercent(forecast.expectedOccupancyRate)}
            subtitle="Belegt + gewichtete Reservierungen"
            accent="amber"
          >
            <div className="mt-[8px] mb-[4px] h-[3px] rounded-full bg-[#191c28]">
              <div
                className="h-full rounded-full bg-[#5b9cf6]"
                style={{ width: `${Math.min(100, Math.max(0, Number(forecast.expectedOccupancyRate) || 0))}%` }}
              />
            </div>
          </HeroCard>
          <HeroCard
            title="Kritische Units"
            value={forecast.criticalUnits}
            subtitle="Negativer Gewinn oder tiefe erwartete Belegung"
            accent="rose"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
          {firstFilteredUnit ? (
            <div className="overflow-hidden rounded-[12px] border border-[#1c2035] bg-[#10121a]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2035] px-[16px] py-[13px]">
                <div>
                  <h3 className="text-[13px] font-medium text-[#edf0f7]">Raumstatus</h3>
                  <p className="mt-[2px] text-[10px] text-[#4a5070]">
                    {firstFilteredUnit.place || firstFilteredUnit.unitId || "Unit"} · Belegt, Reserviert, Frei
                  </p>
                </div>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="rounded-[6px] border border-[#1c2035] bg-[#141720] px-[10px] py-[3px] text-[10px] text-[#4a5070] outline-none"
                >
                  <option value="all">Alle Units</option>
                  {allCoLivingUnits
                    .filter((unit) => selectedPlace === "all" || unit.place === selectedPlace)
                    .map((unit) => (
                      <option key={unit.unitId} value={unit.unitId}>
                        {unit.unitId}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-[12px] border-b border-[#1c2035] px-[16px] py-[8px]">
                <span className="flex items-center gap-1.5 text-[10px] text-[#4a5070]">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#3ddc84]" /> Belegt
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-[#4a5070]">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#f5a623]" /> Reserviert
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-[#4a5070]">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#ff5f6d]" /> Frei
                </span>
              </div>
              <div className="flex flex-wrap gap-[8px] px-[14px] py-[12px]">
                {rooms
                  .filter(
                    (room) =>
                      String(room.unitId || room.unit_id) ===
                      String(firstFilteredUnit.unitId ?? firstFilteredUnit.id)
                  )
                  .map((room) => {
                    const kind = getRoomOccupancyStatus(room, tenancies) || "frei";
                    const cardCls =
                      kind === "belegt"
                        ? "border-[rgba(61,220,132,0.2)] bg-[rgba(61,220,132,0.05)]"
                        : kind === "reserviert"
                          ? "border-[rgba(245,166,35,0.18)] bg-[rgba(245,166,35,0.05)]"
                          : "border-[rgba(255,95,109,0.2)] bg-[rgba(255,95,109,0.05)]";
                    const dotCls =
                      kind === "belegt"
                        ? "bg-[#3ddc84]"
                        : kind === "reserviert"
                          ? "bg-[#f5a623]"
                          : "bg-[#ff5f6d]";
                    const statusColor =
                      kind === "belegt"
                        ? "text-[#3ddc84]"
                        : kind === "reserviert"
                          ? "text-[#f5a623]"
                          : "text-[#ff5f6d]";
                    const statusLabel =
                      kind === "belegt" ? "Belegt" : kind === "reserviert" ? "Reserviert" : "Frei";
                    return (
                      <div
                        key={String(room.id ?? room.roomId ?? room.name)}
                        className={`min-w-[130px] flex-1 rounded-[9px] border p-[11px_13px] ${cardCls}`}
                      >
                        <div className="mb-[6px] flex items-center gap-[6px] text-[12px] font-medium text-[#edf0f7]">
                          <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${dotCls}`} />
                          {room.name || room.roomName || "Zimmer"}
                        </div>
                        <div className="mb-[3px] flex items-baseline justify-between">
                          <span className="text-[10px] text-[#4a5070]">Status</span>
                          <span className={`font-mono text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] text-[#4a5070]">Preis</span>
                          <span className="font-mono text-[11px] text-[#8892b0]">
                            {room.price != null && room.price !== ""
                              ? formatChfOrDash(Number(room.price))
                              : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="rounded-[12px] border border-[#1c2035] bg-[#10121a] px-[16px] py-[24px] text-center text-[11px] text-[#4a5070]">
              Keine Unit für Raumstatus ausgewählt.
            </div>
          )}

          <div className="flex flex-col gap-[10px]">
            <div className="rounded-[12px] border border-[rgba(245,166,35,0.14)] bg-[rgba(245,166,35,0.04)] p-[14px_16px]">
              <h3 className="text-[12px] font-medium text-[#f5a623]">Warnungen</h3>
              <p className="mb-[10px] mt-[2px] text-[10px] text-[#4a5070]">
                Früherkennung für Leerstand, Risiken und schwache Units
              </p>
              <ul className="m-0 list-none p-0">
                {dashboardWarnings.map((warning, index) => (
                  <li
                    key={`${warning.title}-${index}`}
                    className="flex items-start gap-[8px] border-b border-[rgba(245,166,35,0.07)] py-[7px] last:border-b-0"
                  >
                    <span
                      className={`mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full ${
                        warning.type === "danger" ? "bg-[#ff5f6d]" : "bg-[#f5a623]"
                      }`}
                    />
                    <p className="flex-1 text-[11px] leading-[1.5] text-[#8892b0]">
                      <strong className="font-medium text-[#edf0f7]">{warning.title}</strong>: {warning.text}
                    </p>
                    {warning.type === "danger" ? (
                      <span className="shrink-0 rounded-[4px] border border-[rgba(255,95,109,0.2)] bg-[rgba(255,95,109,0.12)] px-[6px] py-[2px] text-[9px] font-semibold text-[#ff5f6d]">
                        Hoch
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-[4px] border border-[rgba(245,166,35,0.2)] bg-[rgba(245,166,35,0.12)] px-[6px] py-[2px] text-[9px] font-semibold text-[#f5a623]">
                        Mittel
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {dashboardWarnings.length === 0 ? (
                <p className="text-[11px] text-[#8892b0]">Keine Warnungen — aktuell keine dringenden Risiken.</p>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-[12px] border border-[#1c2035] bg-[#10121a]">
              <div className="border-b border-[#1c2035] px-[16px] py-[12px]">
                <h3 className="text-[13px] font-medium text-[#edf0f7]">Leerstand 7 Tage</h3>
                <p className="mt-[2px] text-[10px] text-[#4a5070]">Geschätzt über alle gefilterten Rooms</p>
              </div>
              <div className="grid grid-cols-2 gap-[8px] px-[14px] py-[12px]">
                <div className="rounded-[8px] bg-[#141720] p-[10px_12px]">
                  <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.5px] text-[#4a5070]">
                    Leerstandstage gesamt
                  </p>
                  <p className="font-mono text-[16px] font-medium text-[#4a5070]">—</p>
                  <p className="mt-[3px] text-[9px] text-[#4a5070]">Nicht berechnet</p>
                </div>
                <div className="rounded-[8px] bg-[#141720] p-[10px_12px]">
                  <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.5px] text-[#4a5070]">
                    Umsatzverlust 7 Tage
                  </p>
                  <p className="font-mono text-[16px] font-medium text-[#f5a623]">
                    {formatChfOrDash(dashboard.lostRevenue7Days)}
                  </p>
                  <p className="mt-[3px] text-[9px] text-[#4a5070]">Nicht berechnet</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-[10px] mt-2 flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.8px] text-[#4a5070]">
            Auslastung · Bestand · Potenzial
          </span>
          <div className="h-px flex-1 bg-[#1c2035]" />
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr_1fr]">
          <SectionCard
            title="Auslastung auf einen Blick"
            subtitle="So verteilt sich dein aktueller Room-Status"
            rightSlot={
              <span className="rounded-[6px] border border-[rgba(61,220,132,0.25)] bg-[rgba(61,220,132,0.12)] px-2 py-[3px] text-[9px] font-semibold text-[#3ddc84]">
                Live
              </span>
            }
          >
            <div>
              <ProgressRow
                label="Belegt"
                value={dashboardDisplay.occupiedRate}
                count={`${dashboardDisplay.occupiedRooms}`}
                colorClass="bg-[#3ddc84]"
                labelClass="text-[#3ddc84]"
                pctClass="text-[#3ddc84]"
                badgeClass="border-[rgba(61,220,132,0.2)] bg-[rgba(61,220,132,0.12)] text-[#3ddc84]"
              />
              <ProgressRow
                label="Reserviert"
                value={dashboardDisplay.reservedRate}
                count={`${dashboardDisplay.reservedRooms}`}
                colorClass="bg-[#f5a623]"
                labelClass="text-[#f5a623]"
                pctClass="text-[#f5a623]"
                badgeClass="border-[rgba(245,166,35,0.2)] bg-[rgba(245,166,35,0.12)] text-[#f5a623]"
              />
              <ProgressRow
                label="Frei"
                value={dashboardDisplay.freeRate}
                count={`${dashboardDisplay.freeRooms}`}
                colorClass="bg-[#ff5f6d]"
                labelClass="text-[#ff5f6d]"
                pctClass="text-[#ff5f6d]"
                badgeClass="border-[rgba(255,95,109,0.2)] bg-[rgba(255,95,109,0.12)] text-[#ff5f6d]"
              />
            </div>
            <div className="mt-[14px] grid grid-cols-2 gap-[8px]">
              <div className="rounded-[8px] bg-[#141720] p-[10px_12px] text-center">
                <p className="font-mono text-[16px] font-medium text-[#3ddc84]">{dashboardDisplay.occupiedRooms}</p>
                <p className="text-[9px] text-[#4a5070]">Belegt</p>
              </div>
              <div className="rounded-[8px] bg-[#141720] p-[10px_12px] text-center">
                <p className="font-mono text-[16px] font-medium text-[#f5a623]">{dashboardDisplay.reservedRooms}</p>
                <p className="text-[9px] text-[#4a5070]">Reserviert</p>
              </div>
              <div className="rounded-[8px] bg-[#141720] p-[10px_12px] text-center">
                <p className="font-mono text-[16px] font-medium text-[#ff5f6d]">{dashboardDisplay.freeRooms}</p>
                <p className="text-[9px] text-[#4a5070]">Frei</p>
              </div>
              <div className="rounded-[8px] bg-[#141720] p-[10px_12px] text-center">
                <p className="font-mono text-[16px] font-medium text-[#edf0f7]">{dashboardDisplay.totalRooms}</p>
                <p className="text-[9px] text-[#4a5070]">Gesamt</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Bestand & Kapazität" subtitle="Grundstruktur deiner Co-Living Einheiten">
            <div className="flex flex-col gap-[8px]">
              <SmallStatCard
                label="Co-Living Units"
                value={dashboard.unitsCount}
                hint="Alle aktiven Co-Living Einheiten"
                valueClassName="text-[#5b9cf6]"
              />
              <SmallStatCard
                label="Rooms gesamt"
                value={dashboardDisplay.totalRooms}
                hint="Gesamte Zimmerkapazität"
                valueClassName="text-[#edf0f7]"
              />
              <SmallStatCard
                label="Vollbelegte Units"
                value={dashboard.fullUnits}
                hint="Alle Rooms belegt"
                valueClassName="text-[#3ddc84]"
              />
              <SmallStatCard
                label="Teilbelegte Units"
                value={dashboard.partialUnits}
                hint="Mindestens 1 Room belegt"
                valueClassName="text-[#f5a623]"
              />
            </div>
          </SectionCard>

          <SectionCard title="Potenzial & Qualität" subtitle="Was heute schon läuft und was noch offen ist">
            <div className="flex flex-col gap-[8px]">
              <SmallStatCard
                label="Vollbelegung Umsatz"
                value={formatChfOrDash(dashboard.fullRevenue)}
                hint="Maximum bei 100% Auslastung"
                valueClassName="text-[#3ddc84]"
              />
              <SmallStatCard
                label="Leerstand"
                value={formatChfOrDash(dashboard.vacancyLoss)}
                hint="Fehlender Umsatz durch freie Rooms"
                valueClassName="text-[#ff5f6d]"
              />
              <SmallStatCard
                label="Ø Umsatz pro Room"
                value={formatChfOrDash(dashboard.averageRevenuePerRoom)}
                hint="Aktueller Durchschnitt über alle Rooms"
                valueClassName="text-[#5b9cf6]"
              />
              <SmallStatCard
                label="Ø Gewinn pro Unit"
                value={formatChfOrDash(dashboard.averageProfitPerUnit)}
                hint="Aktueller Durchschnitt über alle Co-Living Units"
                valueClassName="text-[#9d7cf4]"
              />
            </div>
          </SectionCard>
        </div>

        <div className="mb-[10px] flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.8px] text-[#4a5070]">Forecast · Tabelle &amp; Charts</span>
          <div className="h-px flex-1 bg-[#1c2035]" />
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-[12px] border border-[#1c2035] bg-[#10121a]">
            <div className="border-b border-[#1c2035] px-[16px] py-[13px]">
              <h3 className="text-[13px] font-medium text-[#edf0f7]">Monatlicher Umsatz-Forecast</h3>
              <p className="mt-[2px] text-[10px] text-[#4a5070]">
                Voraussichtlicher Umsatz und freie Kapazität auf Basis sicherer, reservierter und risikobehafteter Monate
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    <th className="border-b border-[#1c2035] px-[14px] py-[7px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">
                      Monat
                    </th>
                    <th className="border-b border-[#1c2035] px-[14px] py-[7px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">
                      Sicher
                    </th>
                    <th className="border-b border-[#1c2035] px-[14px] py-[7px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">
                      Reserviert
                    </th>
                    <th className="border-b border-[#1c2035] px-[14px] py-[7px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">
                      Risiko
                    </th>
                    <th className="border-b border-[#1c2035] px-[14px] py-[7px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">
                      Offenes Potenzial
                    </th>
                    <th className="border-b border-[#1c2035] px-[14px] py-[7px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">
                      Forecast Umsatz
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRevenueForecast.map((row, fIdx) => (
                    <tr
                      key={row.month}
                      className={`border-b border-[#1c2035] text-[11px] font-mono transition-colors hover:bg-[#141720] ${
                        fIdx === 2 ? "border-l-2 border-l-[#5b9cf6] bg-[rgba(91,156,246,0.04)]" : ""
                      }`}
                    >
                      <td
                        className={`px-[14px] py-[9px] font-medium ${
                          fIdx === 2 ? "text-[#5b9cf6]" : "text-[#edf0f7]"
                        }`}
                      >
                        {fIdx === 2 ? <span className="mr-1 text-[#5b9cf6]">●</span> : null}
                        {row.month}
                      </td>
                      <td className="px-[14px] py-[9px] text-[#3ddc84]">{formatChfOrDash(row.secureRevenue)}</td>
                      <td className="px-[14px] py-[9px] text-[#f5a623]">{formatChfOrDash(row.reservedRevenue)}</td>
                      <td className="px-[14px] py-[9px] text-[#ff5f6d]">{formatChfOrDash(row.riskRevenue)}</td>
                      <td className="px-[14px] py-[9px] text-[#ff5f6d]">{formatChfOrDash(row.freeRevenue)}</td>
                      <td className="px-[14px] py-[9px] font-medium text-[#edf0f7]">
                        {row.forecastRevenue == null ? (
                          <span className="text-[#4a5070]">—</span>
                        ) : (
                          formatChfOrDash(row.forecastRevenue)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-[10px]">
            <div className="overflow-hidden rounded-[12px] border border-[#1c2035] bg-[#10121a]">
              <div className="border-b border-[#1c2035] px-[16px] py-[13px]">
                <h3 className="text-[13px] font-medium text-[#edf0f7]">Monatsverlauf</h3>
                <p className="mt-[2px] text-[10px] text-[#4a5070]">
                  Berechnet auf Basis des gewählten Monatsfilters und der Room-Daten.
                </p>
              </div>
              <div className="h-[420px] w-full px-[16px] py-[14px] text-[#4a5070]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyChartData}>
                    <defs>
                      <linearGradient id="coLinGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(245,166,35,0.25)" />
                        <stop offset="100%" stopColor="rgba(245,166,35,0)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1c2035" strokeWidth={0.5} strokeDasharray="3 4" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#4a5070", fontSize: 9, fontFamily: "DM Sans, ui-sans-serif, system-ui" }}
                    />
                    <YAxis tick={{ fill: "#4a5070", fontSize: 9, fontFamily: "DM Sans, ui-sans-serif, system-ui" }} />
                    <Tooltip
                      formatter={(value) =>
                        value === null || value === undefined ? "-" : formatCurrency(value)
                      }
                      contentStyle={{
                        background: "#10121a",
                        border: "1px solid #1c2035",
                        borderRadius: 8,
                        color: "#edf0f7",
                        fontSize: 11,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="umsatz"
                      stroke="none"
                      fill="url(#coLinGrad)"
                    />
                    <Line
                      type="monotone"
                      dataKey="umsatz"
                      name="Umsatz"
                      stroke="#f5a623"
                      strokeWidth={1.8}
                      dot={{ r: 3, fill: "#f5a623" }}
                      activeDot={{ r: 5 }}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-hidden rounded-[12px] border border-[#1c2035] bg-[#10121a]">
              <div className="border-b border-[#1c2035] px-[16px] py-[13px]">
                <h3 className="text-[13px] font-medium text-[#edf0f7]">Room-Status aktuell</h3>
                <p className="mt-[2px] text-[10px] text-[#4a5070]">Live aus deinen Co-Living Rooms berechnet</p>
              </div>
              <div className="h-[420px] w-full px-[16px] py-[14px] text-[#4a5070]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={roomStatusChartData} barCategoryGap={28}>
                    <CartesianGrid stroke="#1c2035" strokeWidth={0.5} strokeDasharray="3 4" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#4a5070", fontSize: 9, fontFamily: "DM Sans, ui-sans-serif, system-ui" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#4a5070", fontSize: 9, fontFamily: "DM Sans, ui-sans-serif, system-ui" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#10121a",
                        border: "1px solid #1c2035",
                        borderRadius: 8,
                        color: "#edf0f7",
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="value" name="Anzahl Rooms" radius={[3, 3, 0, 0]}>
                      {roomStatusChartData.map((entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={["#3ddc84", "#f5a623", "#ff5f6d"][i]}
                          fillOpacity={Number(entry.value) === 0 ? 0.3 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {dashboard.notStartedUnits > 0 && (
          <div className="rounded-[10px] border border-amber-500/[0.15] bg-amber-500/[0.06] p-4">
            <p className="text-[13px] text-[#fbbf24]">
              Hinweis: {dashboard.notStartedUnits} Unit(s) haben einen zukünftigen
              Mietstart beim Vermieter. Diese laufenden Kosten werden aktuell
              noch nicht in die Live-Ausgaben einberechnet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminCoLivingDashboardPage;