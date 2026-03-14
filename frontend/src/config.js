/**
 * Central API configuration. Use for all backend requests.
 * Set REACT_APP_BACKEND_URL in .env (e.g. http://localhost:8000 for dev).
 * Set REACT_APP_ADMIN_API_KEY in .env when backend uses ADMIN_API_KEY (production).
 */
const API_BASE_URL =
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";

/** localStorage key for admin JWT (used by login page and getApiHeaders). */
export const ADMIN_TOKEN_KEY = "fah_admin_token";

/**
 * Headers for admin/protected API calls (invoices, inquiries, listings).
 * Sends JWT Bearer token if stored (ADMIN_TOKEN_KEY), else X-API-Key if set.
 */
export function getApiHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    const key = process.env.REACT_APP_ADMIN_API_KEY;
    if (key) headers["X-API-Key"] = key;
  }
  return headers;
}

export { API_BASE_URL };
export default API_BASE_URL;
