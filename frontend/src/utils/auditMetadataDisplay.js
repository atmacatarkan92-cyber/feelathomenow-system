/**
 * Human-friendly audit metadata (request / login context) — display-only.
 * Unknown keys stay in `remainder` for raw JSON fallback.
 */

import {
  getBrowserNameFromUserAgent,
  getDeviceLabelFromUserAgent,
  getOsNameFromUserAgent,
} from "./userAgentLabel";

const META_KEYS_CONSUMED = new Set([
  "ip_address",
  "location_city",
  "location_country",
  "user_agent",
  "source",
  "request_id",
  "device_status",
  "login_device_status",
  "impersonation_started_at",
]);

/**
 * @param {Record<string, unknown>|null|undefined} meta
 * @returns {{ known: { key: string, label: string, value: string }[], remainder: Record<string, unknown> | null, rows: { key: string, label: string, value: string }[] }}
 */
export function partitionAuditMetadata(meta) {
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) {
    return { known: [], remainder: null, rows: [] };
  }

  const remainder = { ...meta };
  /** @type {{ key: string, label: string, value: string }[]} */
  const known = [];

  function take(key) {
    if (!Object.prototype.hasOwnProperty.call(remainder, key)) return;
    const raw = remainder[key];
    delete remainder[key];
    return raw;
  }

  const ip = take("ip_address");
  if (ip != null && String(ip).trim() !== "") {
    known.push({ key: "ip_address", label: "IP-Adresse", value: String(ip) });
  }

  const locCity = take("location_city");
  const locCountry = take("location_country");
  const locParts = [locCity, locCountry].filter((x) => x != null && String(x).trim() !== "");
  if (locParts.length) {
    known.push({
      key: "location",
      label: "Standort",
      value: locParts.map((x) => String(x).trim()).join(", "),
    });
  }

  const ua = take("user_agent");
  if (ua != null && String(ua).trim() !== "") {
    const uaStr = String(ua);
    known.push({
      key: "device",
      label: "Gerät (Kurz)",
      value: getDeviceLabelFromUserAgent(uaStr),
    });
    known.push({
      key: "browser",
      label: "Browser",
      value: getBrowserNameFromUserAgent(uaStr),
    });
    known.push({
      key: "os",
      label: "Betriebssystem",
      value: getOsNameFromUserAgent(uaStr),
    });
  }

  const src = take("source");
  if (src != null && String(src).trim() !== "") {
    known.push({ key: "source", label: "Quelle", value: String(src) });
  }

  const rid = take("request_id");
  if (rid != null && String(rid).trim() !== "") {
    known.push({ key: "request_id", label: "Request-ID", value: String(rid) });
  }

  const devSt = take("device_status") ?? take("login_device_status");
  if (devSt != null && String(devSt).trim() !== "") {
    known.push({ key: "device_status", label: "Gerätestatus", value: String(devSt) });
  }

  const imp = take("impersonation_started_at");
  if (imp != null && String(imp).trim() !== "") {
    known.push({ key: "impersonation_started_at", label: "Impersonation (Start)", value: String(imp) });
  }

  if (ua != null && String(ua).trim() !== "") {
    known.push({
      key: "user_agent_raw",
      label: "User-Agent (vollständig)",
      value: String(ua),
    });
  }

  for (const k of META_KEYS_CONSUMED) {
    if (Object.prototype.hasOwnProperty.call(remainder, k)) {
      delete remainder[k];
    }
  }

  const restKeys = Object.keys(remainder).filter((k) => {
    const v = remainder[k];
    if (v == null) return false;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return false;
    return true;
  });

  const outRemainder = restKeys.length ? remainder : null;
  return {
    known,
    remainder: outRemainder,
    rows: known,
  };
}
