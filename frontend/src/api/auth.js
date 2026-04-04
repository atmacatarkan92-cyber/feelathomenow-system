/**
 * Auth API client: login, refresh, logout, getMe.
 * Phase 2: login/refresh set access token in authStore; refresh token in HttpOnly cookie.
 * Use credentials: "include" so cookies are sent and received.
 */
import { API_BASE_URL, getApiHeaders } from "../config";
import { setAccessToken, clearAccessToken } from "../authStore";

const CREDENTIALS = "include";

/** Backend `detail` when login is blocked until email is verified (POST /auth/login 403). */
export const LOGIN_DETAIL_EMAIL_NOT_VERIFIED = "email_not_verified";

export async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
    credentials: CREDENTIALS,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    const message =
      data.detail != null
        ? typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail)
        : `Fehler ${response.status}`;
    throw new Error(message);
  }
  if (data.access_token) {
    setAccessToken(data.access_token);
  }
  return data;
}

/**
 * POST /auth/verify-email — confirm email with one-time token from the verification link.
 */
export async function verifyEmail(token) {
  const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: String(token).trim() }),
    credentials: CREDENTIALS,
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (response.status === 429) {
    throw new Error("Zu viele Anfragen. Bitte versuche es später erneut.");
  }
  if (!response.ok) {
    const message =
      data.detail != null
        ? typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail)
        : `Fehler ${response.status}`;
    throw new Error(message);
  }
  return data;
}

/**
 * POST /auth/resend-verification — generic success body (no account enumeration).
 */
export async function resendVerificationEmail(email) {
  const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
    credentials: CREDENTIALS,
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (response.status === 429) {
    throw new Error("Zu viele Anfragen. Bitte versuche es später erneut.");
  }
  if (!response.ok) {
    const message =
      data.detail != null
        ? typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail)
        : `Fehler ${response.status}`;
    throw new Error(message);
  }
  return data;
}

/**
 * Exchange refresh token (from HttpOnly cookie) for a new access token.
 * Call with credentials: "include" so the cookie is sent.
 * On success, sets new access token in authStore and returns it.
 */
export async function refresh() {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: CREDENTIALS,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    clearAccessToken();
    throw new Error(data.detail || "Refresh fehlgeschlagen.");
  }
  if (data.access_token) {
    setAccessToken(data.access_token);
  }
  return data;
}

/**
 * Revoke refresh token on server and clear cookie. Clears in-memory access token.
 */
export async function logout() {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: CREDENTIALS,
    });
  } finally {
    clearAccessToken();
  }
}

export async function getMe() {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: getApiHeaders(),
    credentials: CREDENTIALS,
  });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Session konnte nicht geladen werden.");
  }
  const data = await response.json();
  return data;
}
