"""
Automatic geocoding for Property addresses (Google Geocoding API, server-side only).

Reuses the same API key env vars as routes_admin_address:
GOOGLE_MAPS_GEOCODING_API_KEY or GOOGLE_MAPS_API_KEY.

Does not log full address strings; logs only outcome and query length on failure.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional, Tuple

import requests
from sqlmodel import Session

from db.models import Property

logger = logging.getLogger("app.property_geocoding")

GEO_TIMEOUT_S = 12


def _geocoding_api_key() -> Optional[str]:
    raw = os.environ.get("GOOGLE_MAPS_GEOCODING_API_KEY") or os.environ.get("GOOGLE_MAPS_API_KEY") or ""
    return raw.strip() or None


def _norm(s: Optional[str]) -> str:
    return (s or "").strip()


def property_address_signature(
    street: Optional[str],
    house_number: Optional[str],
    zip_code: Optional[str],
    city: Optional[str],
    country: Optional[str],
) -> Tuple[str, str, str, str, str]:
    """Normalized tuple for change detection (case-insensitive compare)."""
    return (
        _norm(street).casefold(),
        _norm(house_number).casefold(),
        _norm(zip_code).casefold(),
        _norm(city).casefold(),
        (_norm(country) or "ch").casefold(),
    )


def property_address_signature_from_model(p: Property) -> Tuple[str, str, str, str, str]:
    return property_address_signature(
        getattr(p, "street", None),
        getattr(p, "house_number", None),
        getattr(p, "zip_code", None),
        getattr(p, "city", None),
        getattr(p, "country", None),
    )


def build_geocoding_query(
    street: Optional[str],
    house_number: Optional[str],
    zip_code: Optional[str],
    city: Optional[str],
    country: Optional[str],
) -> Optional[str]:
    """
    Build a single-line query for Google Geocoding.
    Returns None if the address is too incomplete to geocode meaningfully.
    """
    plz = _norm(zip_code)
    city_n = _norm(city)
    line1 = " ".join(p for p in (_norm(street), _norm(house_number)) if p).strip()
    country_n = _norm(country) or "CH"

    if plz and city_n:
        if line1:
            return f"{line1}, {plz} {city_n}, {country_n}"
        return f"{plz} {city_n}, {country_n}"
    if line1 and city_n:
        return f"{line1}, {city_n}, {country_n}"
    return None


def _parse_lat_lng_from_google_payload(data: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    results = data.get("results") or []
    if not results:
        return None
    first = results[0]
    geom = first.get("geometry") or {}
    loc = geom.get("location") or {}
    try:
        lat = float(loc.get("lat"))
        lng = float(loc.get("lng"))
    except (TypeError, ValueError):
        return None
    return lat, lng


def geocode_query(query: str) -> Tuple[str, Optional[Tuple[float, float]], Optional[str]]:
    """
    Call Google Geocoding API. Returns:
      (status, (lat, lng) or None, reason_code or None)
    status: ok | failed | skipped
    """
    api_key = _geocoding_api_key()
    if not api_key:
        logger.info("Geocoding skipped: no API key configured (len query=%s)", len(query))
        return "skipped", None, "provider_unavailable"

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    try:
        r = requests.get(
            url,
            params={"address": query, "key": api_key, "region": "ch"},
            timeout=GEO_TIMEOUT_S,
        )
        r.raise_for_status()
        data = r.json()
    except requests.RequestException as e:
        logger.warning("Geocoding HTTP/request error: %s", e)
        return "failed", None, "http_error"

    status = data.get("status")
    if status == "ZERO_RESULTS":
        logger.info("Geocoding ZERO_RESULTS (len query=%s)", len(query))
        return "failed", None, "zero_results"
    if status not in ("OK",):
        msg = str(data.get("error_message") or status or "error")
        logger.info("Geocoding non-OK status=%s msg=%s", status, msg[:120])
        return "failed", None, "provider_error"

    coords = _parse_lat_lng_from_google_payload(data)
    if not coords:
        return "failed", None, "provider_error"
    return "ok", coords, None


def apply_property_geocoding(
    session: Session,
    prop: Property,
    *,
    address_changed: bool,
    force: bool = False,
) -> Dict[str, Any]:
    """
    Update prop.lat / prop.lng when appropriate. Caller must commit.

    Rules:
    - If address did not change: do not touch coordinates; return skipped/unchanged.
      Exception: force=True (manual retry) always attempts geocoding with current address fields.
    - If address changed and query is incomplete: clear lat/lng (avoid stale map pins).
    - If address changed and geocoding succeeds: set new lat/lng.
    - If address changed and geocoding fails or is unavailable: clear lat/lng.

    Returns metadata dict for API response, e.g.:
      {"status": "ok", "reason": null}
      {"status": "skipped", "reason": "unchanged"}
      {"status": "skipped", "reason": "incomplete_address"}
      {"status": "failed", "reason": "zero_results"}
    """
    if not force and not address_changed:
        return {"status": "skipped", "reason": "unchanged"}

    q = build_geocoding_query(
        getattr(prop, "street", None),
        getattr(prop, "house_number", None),
        getattr(prop, "zip_code", None),
        getattr(prop, "city", None),
        getattr(prop, "country", None),
    )
    if not q:
        prop.lat = None
        prop.lng = None
        session.add(prop)
        return {"status": "skipped", "reason": "incomplete_address"}

    st, coords, reason = geocode_query(q)
    if st == "ok" and coords:
        prop.lat, prop.lng = coords[0], coords[1]
        session.add(prop)
        return {"status": "ok", "reason": None}

    prop.lat = None
    prop.lng = None
    session.add(prop)
    if st == "skipped":
        return {"status": "skipped", "reason": reason or "provider_unavailable"}
    return {"status": "failed", "reason": reason or "provider_error"}
