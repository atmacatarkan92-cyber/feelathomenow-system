import { buildLoginDeviceStatusMap } from "./loginDeviceAuditStatus";

/**
 * Read-time heuristics for platform audit login rows (newest-first API order).
 * No backend writes; safe to reuse for alerts/email later.
 */

/**
 * Normalized location key from backend enrichment (city/country only).
 * @param {Record<string, unknown>} row
 * @returns {string|null}
 */
export function loginLocationSignature(row) {
  if (row.action !== "login") return null;
  const c =
    row.location_country != null && String(row.location_country).trim() !== ""
      ? String(row.location_country).trim().toLowerCase()
      : "";
  const city =
    row.location_city != null && String(row.location_city).trim() !== ""
      ? String(row.location_city).trim().toLowerCase()
      : "";
  if (!c && !city) return null;
  return `${c}|${city}`;
}

/**
 * Collect normalized location signatures from strictly older login rows (same actor).
 * @param {Array<Record<string, unknown>>} rowsNewestFirst
 * @param {number} index
 * @param {unknown} actorUserId
 * @returns {Set<string>}
 */
function priorLocationSignaturesForActor(rowsNewestFirst, index, actorUserId) {
  const actor = actorUserId != null ? String(actorUserId) : "";
  const set = new Set();
  for (let j = index + 1; j < rowsNewestFirst.length; j++) {
    const older = rowsNewestFirst[j];
    if (older.action !== "login") continue;
    if (String(older.actor_user_id || "") !== actor) continue;
    const sig = loginLocationSignature(older);
    if (sig != null) set.add(sig);
  }
  return set;
}

/**
 * @typedef {{ suspicious: boolean, reasons: string[] }} SuspiciousLoginAuditInfo
 */

/**
 * @param {Array<Record<string, unknown>>} rowsNewestFirst
 * @returns {Map<string, SuspiciousLoginAuditInfo>}
 */
export function buildSuspiciousLoginAuditMap(rowsNewestFirst) {
  const map = new Map();
  if (!Array.isArray(rowsNewestFirst)) {
    return map;
  }
  const deviceStatusById = buildLoginDeviceStatusMap(rowsNewestFirst);

  for (let i = 0; i < rowsNewestFirst.length; i++) {
    const row = rowsNewestFirst[i];
    if (row.action !== "login") {
      map.set(String(row.id), { suspicious: false, reasons: [] });
      continue;
    }
    /** @type {string[]} */
    const reasons = [];
    const deviceStatus = deviceStatusById.get(row.id);
    if (deviceStatus === "new") {
      reasons.push(
        "Neues Gerät: In den letzten 50 sichtbaren Einträgen wurde dieses Gerät für diesen Benutzer noch nicht gesehen.",
      );
    }

    const currentSig = loginLocationSignature(row);
    const priorSigs = priorLocationSignaturesForActor(rowsNewestFirst, i, row.actor_user_id);
    if (currentSig != null && priorSigs.size > 0 && !priorSigs.has(currentSig)) {
      reasons.push(
        "Neuer Ort: Der ungefähre Standort weicht von früheren sichtbaren Logins dieses Benutzers in dieser Liste ab.",
      );
    }

    map.set(String(row.id), {
      suspicious: reasons.length > 0,
      reasons,
    });
  }
  return map;
}
