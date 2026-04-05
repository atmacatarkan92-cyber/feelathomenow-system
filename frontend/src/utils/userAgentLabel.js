/**
 * Rule-based user-agent → human-readable device label (German).
 * Reusable for audit UI and future “new device” heuristics (compare with stored raw UA).
 *
 * @param {string|null|undefined} userAgent
 * @returns {string}
 */
export function getBrowserNameFromUserAgent(userAgent) {
  if (userAgent == null || String(userAgent).trim() === "") {
    return "Unbekannter Browser";
  }
  const s = String(userAgent);
  if (/Edg\//i.test(s)) return "Edge";
  if (/OPR\/|Opera\//i.test(s)) return "Opera";
  if (/Firefox\//i.test(s)) return "Firefox";
  if (/CriOS\//i.test(s)) return "Chrome";
  if (/Chrome\//i.test(s) || /Chromium\//i.test(s)) return "Chrome";
  if (/Safari\//i.test(s)) return "Safari";
  return "Unbekannter Browser";
}

export function getOsNameFromUserAgent(userAgent) {
  if (userAgent == null || String(userAgent).trim() === "") {
    return "Unbekanntes System";
  }
  const s = String(userAgent);
  if (/CrOS/i.test(s)) return "Chrome OS";
  if (/iPhone/i.test(s)) return "iPhone";
  if (/iPad/i.test(s)) return "iPad";
  if (/Android/i.test(s)) return "Android";
  if (/Windows NT/i.test(s)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(s)) return "macOS";
  if (/Linux/i.test(s)) return "Linux";
  return "Unbekanntes System";
}

export function getDeviceLabelFromUserAgent(userAgent) {
  if (userAgent == null || String(userAgent).trim() === "") {
    return "Unbekanntes Gerät";
  }
  const s = String(userAgent);
  const browser = getBrowserNameFromUserAgent(s);
  const os = getOsNameFromUserAgent(s);
  return `${browser} auf ${os}`;
}
