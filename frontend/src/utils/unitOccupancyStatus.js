/**
 * Derived unit occupancy from tenancies + rooms (frontend-only).
 * Single source of truth for occupancy labels used in admin UI.
 */

export function getTodayIsoForOccupancy() {
  return new Date().toISOString().slice(0, 10);
}

export function parseIsoDate(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw);
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return s.slice(0, 10);
}

export function isTenancyActiveByDates(t, todayIso) {
  const moveIn = parseIsoDate(t?.move_in_date);
  if (!moveIn || moveIn > todayIso) return false;
  const moveOut = t?.move_out_date ? parseIsoDate(t.move_out_date) : null;
  if (moveOut && moveOut < todayIso) return false;
  return true;
}

export function isTenancyFuture(t, todayIso) {
  const moveIn = parseIsoDate(t?.move_in_date);
  return moveIn != null && moveIn > todayIso;
}

/**
 * @param {object} unit
 * @param {object[]|null|undefined} rooms
 * @param {object[]|null|undefined} tenancies — null/undefined = data not available
 * @returns {null | 'frei' | 'reserviert' | 'belegt' | 'teilbelegt'}
 */
export function getUnitOccupancyStatus(unit, rooms, tenancies) {
  if (!unit) return null;
  if (tenancies == null) return null;
  const today = getTodayIsoForOccupancy();
  const uid = String(unit.unitId || unit.id || "");
  const unitTenancies = tenancies.filter(
    (t) => String(t.unit_id || t.unitId) === uid
  );

  const type = String(unit.type || "").trim();
  const isCoLiving = type === "Co-Living";

  if (!isCoLiving) {
    let hasActive = false;
    let hasFuture = false;
    for (const t of unitTenancies) {
      if (isTenancyActiveByDates(t, today)) hasActive = true;
      if (isTenancyFuture(t, today)) hasFuture = true;
    }
    if (hasActive) return "belegt";
    if (hasFuture) return "reserviert";
    return "frei";
  }

  const unitRooms = (rooms || []).filter(
    (r) => String(r.unitId || r.unit_id) === uid
  );
  const totalRooms =
    Math.floor(Number(unit.rooms) || 0) || unitRooms.length;
  if (totalRooms <= 0) return null;

  let occupiedRooms = 0;
  let futureRooms = 0;
  for (const room of unitRooms) {
    const rid = String(room.roomId || room.id || "");
    const roomT = unitTenancies.filter((t) => String(t.room_id) === rid);
    const hasActive = roomT.some((tt) => isTenancyActiveByDates(tt, today));
    const hasFuture = roomT.some((tt) => isTenancyFuture(tt, today));
    if (hasActive) occupiedRooms++;
    else if (hasFuture) futureRooms++;
  }

  if (occupiedRooms === 0 && futureRooms === 0) return "frei";
  if (occupiedRooms === 0 && futureRooms > 0) return "reserviert";
  if (occupiedRooms >= totalRooms) return "belegt";
  if (occupiedRooms > 0 && occupiedRooms < totalRooms) return "teilbelegt";
  return "frei";
}

export function formatOccupancyStatusDe(key) {
  if (key == null) return "—";
  const m = {
    frei: "Frei",
    reserviert: "Reserviert",
    belegt: "Belegt",
    teilbelegt: "Teilbelegt",
  };
  return m[key] || key;
}

/** Tailwind badge tone for admin Badge / spans (matches AdminUnitDetailPage Badge). */
export function occupancyStatusBadgeTone(key) {
  if (key === "frei") return "slate";
  if (key === "reserviert") return "blue";
  if (key === "teilbelegt") return "orange";
  if (key === "belegt") return "green";
  return "slate";
}

const BADGE_TONE_CLASSES = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-700",
  orange: "bg-orange-100 text-orange-700",
  blue: "bg-sky-100 text-sky-700",
};

export function occupancyStatusBadgeClassName(statusKey) {
  const tone = occupancyStatusBadgeTone(statusKey);
  return BADGE_TONE_CLASSES[tone] || BADGE_TONE_CLASSES.slate;
}

/**
 * Landlord contract lease start (Vertrag Vermieter).
 * Missing lease_start_date → not started (exclude from revenue / active KPIs).
 */
export function isLandlordContractLeaseStarted(
  unit,
  todayIso = getTodayIsoForOccupancy()
) {
  const d = parseIsoDate(unit?.leaseStartDate ?? unit?.lease_start_date);
  if (d == null) return false;
  return d <= todayIso;
}

function isoDateAddDays(iso, days) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1;
  const day = Number(iso.slice(8, 10));
  const dt = new Date(Date.UTC(y, m, day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Single contract state for Vertrag Vermieter (deterministic order).
 * @returns {"active"|"expiring_soon"|"expired"|"ended"|"unknown"}
 */
export function getUnitContractState(unit) {
  if (!unit) return "unknown";
  const ls = String(unit.leaseStatus ?? unit.lease_status ?? "").trim();
  if (ls === "ended") return "ended";

  const start = parseIsoDate(unit?.leaseStartDate ?? unit?.lease_start_date);
  if (start == null) return "unknown";

  const today = getTodayIsoForOccupancy();
  const end = parseIsoDate(unit?.leaseEndDate ?? unit?.lease_end_date);
  if (end != null && end < today) return "expired";

  if (end != null) {
    const limit = isoDateAddDays(today, 60);
    if (limit != null && end <= limit) return "expiring_soon";
  }

  return "active";
}

/** Block new tenancies when landlord lease contract is ended (frontend-only). */
export const UNIT_LANDLORD_LEASE_ENDED_TENANCY_MESSAGE =
  "Diese Einheit ist beendet (Vertrag Vermieter). Es können keine neuen Mietverhältnisse erstellt werden.";
