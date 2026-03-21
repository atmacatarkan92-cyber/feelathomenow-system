/**
 * Central API configuration. Use for all backend requests.
 * Set REACT_APP_API_URL in .env (e.g. http://localhost:8000 for dev). See .env.example.
 * Set REACT_APP_ADMIN_API_KEY in .env when backend uses ADMIN_API_KEY (production).
 */
import { getAccessToken } from "./authStore";

const API_BASE_URL = process.env.REACT_APP_API_URL || "";

export function getApiHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = getAccessToken();
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
