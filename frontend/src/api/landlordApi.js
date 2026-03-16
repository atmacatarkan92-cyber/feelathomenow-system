/**
 * Landlord portal API: GET /api/landlord/me, /properties, /units, /tenancies, /invoices.
 * Uses same auth as tenant/admin (Bearer token from authStore); requires role=landlord.
 * All endpoints exist in backend (Phase 1).
 */
import { API_BASE_URL, getApiHeaders } from "../config";

const opts = () => ({ headers: getApiHeaders(), credentials: "include" });

export function fetchLandlordMe() {
  return fetch(`${API_BASE_URL}/api/landlord/me`, opts()).then((res) => {
    if (res.status === 403) throw new Error("Kein Vermieter-Zugang.");
    if (!res.ok) throw new Error("Profil konnte nicht geladen werden.");
    return res.json();
  });
}

export function fetchLandlordProperties() {
  return fetch(`${API_BASE_URL}/api/landlord/properties`, opts()).then((res) => {
    if (res.status === 403) throw new Error("Kein Vermieter-Zugang.");
    if (!res.ok) throw new Error("Objekte konnten nicht geladen werden.");
    return res.json();
  });
}

export function fetchLandlordUnits(propertyId = null) {
  const url = propertyId
    ? `${API_BASE_URL}/api/landlord/units?property_id=${encodeURIComponent(propertyId)}`
    : `${API_BASE_URL}/api/landlord/units`;
  return fetch(url, opts()).then((res) => {
    if (res.status === 403) throw new Error("Kein Vermieter-Zugang.");
    if (!res.ok) throw new Error("Einheiten konnten nicht geladen werden.");
    return res.json();
  });
}

export function createLandlordUnit(body) {
  return fetch(`${API_BASE_URL}/api/landlord/units`, {
    method: "POST",
    ...opts(),
    body: JSON.stringify(body),
  }).then(async (res) => {
    if (res.status === 403) throw new Error("Kein Vermieter-Zugang oder Objekt nicht zugeordnet.");
    if (!res.ok) {
      let msg = "Einheit konnte nicht erstellt werden.";
      try {
        const data = await res.json();
        if (data.detail) msg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  });
}

export function fetchLandlordTenancies() {
  return fetch(`${API_BASE_URL}/api/landlord/tenancies`, opts()).then((res) => {
    if (res.status === 403) throw new Error("Kein Vermieter-Zugang.");
    if (!res.ok) throw new Error("Mietverhältnisse konnten nicht geladen werden.");
    return res.json();
  });
}

export function fetchLandlordInvoices() {
  return fetch(`${API_BASE_URL}/api/landlord/invoices`, opts()).then((res) => {
    if (res.status === 403) throw new Error("Kein Vermieter-Zugang.");
    if (!res.ok) throw new Error("Rechnungen konnten nicht geladen werden.");
    return res.json();
  });
}
