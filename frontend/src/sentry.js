/**
 * Optional Sentry for frontend error tracking.
 * To enable: install @sentry/react, set REACT_APP_SENTRY_DSN, and call initSentry() from index.js.
 * Do not enable by default.
 */
export function initSentry() {
  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (!dsn || !dsn.trim()) return;
  // When enabling: import * as Sentry from "@sentry/react";
  // Sentry.init({ dsn, environment: process.env.NODE_ENV, tracesSampleRate: 0.1 });
}
