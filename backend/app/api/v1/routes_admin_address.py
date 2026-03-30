"""
Admin address verification (Google Geocoding API compatible).

Uses GOOGLE_MAPS_GEOCODING_API_KEY, or falls back to GOOGLE_MAPS_API_KEY.
Does not persist anything.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

import requests
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth.dependencies import get_current_organization, require_roles

logger = logging.getLogger("app.admin_address")

router = APIRouter(prefix="/api/admin", tags=["admin-address"])


def _geocoding_api_key() -> Optional[str]:
    raw = os.environ.get("GOOGLE_MAPS_GEOCODING_API_KEY") or os.environ.get("GOOGLE_MAPS_API_KEY") or ""
    return raw.strip() or None


class AddressVerifyRequest(BaseModel):
    address_line1: str = ""
    postal_code: str = ""
    city: str = ""


class AddressVerifyResponse(BaseModel):
    valid: bool
    message: Optional[str] = None
    formatted_address: Optional[str] = None
    normalized: Optional[dict[str, Optional[str]]] = None


def _build_query(a1: str, plz: str, city: str) -> str:
    parts = [p.strip() for p in (a1, f"{plz} {city}".strip()) if p and p.strip()]
    if not parts:
        return ""
    return ", ".join(parts) + ", Switzerland"


def _parse_components(components: list[dict[str, Any]]) -> dict[str, Optional[str]]:
    route = ""
    street_number = ""
    postal_code = ""
    city = ""
    canton = ""
    for c in components:
        types = c.get("types") or []
        ln = str(c.get("long_name") or "")
        sn = str(c.get("short_name") or "")
        if "street_number" in types:
            street_number = ln
        if "route" in types:
            route = ln
        if "postal_code" in types:
            postal_code = ln
        if "locality" in types:
            city = ln
        elif "postal_town" in types and not city:
            city = ln
        if "administrative_area_level_1" in types:
            if len(sn) == 2 and sn.isalpha():
                canton = sn.upper()
            elif len(sn) <= 4 and sn.isalpha():
                canton = sn.upper()
    line1 = f"{route} {street_number}".strip()
    out: dict[str, Optional[str]] = {}
    if line1:
        out["address_line1"] = line1
    if postal_code:
        out["postal_code"] = postal_code
    if city:
        out["city"] = city
    if canton:
        out["canton"] = canton
    return out


@router.post("/address/verify", response_model=AddressVerifyResponse)
def admin_verify_address(
    body: AddressVerifyRequest,
    _org_id: str = Depends(get_current_organization),
    __=Depends(require_roles("admin", "manager")),
):
    """
    Verify / normalize an address via Google Geocoding (optional API key).
    """
    a1 = (body.address_line1 or "").strip()
    plz = (body.postal_code or "").strip()
    city = (body.city or "").strip()
    if not a1 and not plz and not city:
        return AddressVerifyResponse(
            valid=False,
            message="Bitte Adresse, PLZ und Ort eintragen, bevor Sie prüfen.",
        )

    api_key = _geocoding_api_key()
    if not api_key:
        return AddressVerifyResponse(
            valid=False,
            message="Adressprüfung ist nicht konfiguriert (GOOGLE_MAPS_GEOCODING_API_KEY oder GOOGLE_MAPS_API_KEY).",
        )

    query = _build_query(a1, plz, city)
    if not query:
        return AddressVerifyResponse(valid=False, message="Adresseingabe unvollständig.")

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    try:
        r = requests.get(
            url,
            params={"address": query, "key": api_key, "region": "ch"},
            timeout=12,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.warning("Geocoding request failed: %s", e)
        return AddressVerifyResponse(
            valid=False,
            message="Adressprüfung vorübergehend nicht verfügbar. Bitte später erneut versuchen.",
        )

    status = data.get("status")
    if status == "ZERO_RESULTS":
        return AddressVerifyResponse(
            valid=False,
            message="Keine passende Adresse gefunden.",
        )
    if status not in ("OK",):
        msg = str(data.get("error_message") or status or "Geocoding-Fehler")
        logger.info("Geocoding status=%s msg=%s", status, msg)
        return AddressVerifyResponse(
            valid=False,
            message="Adressprüfung fehlgeschlagen. Bitte Eingabe prüfen oder später erneut versuchen.",
        )

    results = data.get("results") or []
    if not results:
        return AddressVerifyResponse(valid=False, message="Keine Ergebnisse.")

    first = results[0]
    formatted = str(first.get("formatted_address") or "").strip()
    comps = first.get("address_components") or []
    normalized = _parse_components(comps if isinstance(comps, list) else [])

    return AddressVerifyResponse(
        valid=True,
        formatted_address=formatted or None,
        normalized=normalized if normalized else None,
        message=None,
    )
