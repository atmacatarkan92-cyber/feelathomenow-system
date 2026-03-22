/**
 * Central API configuration. Use for all backend requests.
 * Set REACT_APP_API_URL in .env (e.g. http://localhost:8000 for dev). See .env.example.
 */
import { getAccessToken } from "./authStore";

const API_BASE_URL = process.env.REACT_APP_API_URL || "";

export function getApiHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export { API_BASE_URL };
export default API_BASE_URL;
