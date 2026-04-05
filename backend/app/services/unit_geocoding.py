"""
Automatic geocoding for Unit addresses (same provider stack as Property).

Uses unit.address + postal_code + city with default country CH (no country column on Unit).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from sqlmodel import Session

from app.services.property_geocoding import (
    build_geocoding_query,
    geocode_query,
)
from db.models import Unit


def _norm(s: Optional[str]) -> str:
    return (s or "").strip()


def unit_address_signature(
    address: Optional[str],
    postal_code: Optional[str],
    city: Optional[str],
) -> Tuple[str, str, str]:
    """Normalized tuple for change detection (case-insensitive compare)."""
    return (
        _norm(address).casefold(),
        _norm(postal_code).casefold(),
        _norm(city).casefold(),
    )


def unit_address_signature_from_model(u: Unit) -> Tuple[str, str, str]:
    return unit_address_signature(
        getattr(u, "address", None),
        getattr(u, "postal_code", None),
        getattr(u, "city", None),
    )


def apply_unit_geocoding(
    session: Session,
    unit: Unit,
    *,
    address_changed: bool,
    force: bool = False,
) -> Dict[str, Any]:
    """
    Update unit.latitude / unit.longitude / geocoded_at when appropriate. Caller must commit.

    Same rules as apply_property_geocoding, using address as a single street line.
    """
    if not force and not address_changed:
        return {"status": "skipped", "reason": "unchanged"}

    q = build_geocoding_query(
        getattr(unit, "address", None),
        None,
        getattr(unit, "postal_code", None),
        getattr(unit, "city", None),
        "CH",
    )
    if not q:
        unit.latitude = None
        unit.longitude = None
        unit.geocoded_at = None
        session.add(unit)
        return {"status": "skipped", "reason": "incomplete_address"}

    st, coords, reason = geocode_query(q)
    if st == "ok" and coords:
        unit.latitude, unit.longitude = coords[0], coords[1]
        unit.geocoded_at = datetime.utcnow()
        session.add(unit)
        return {"status": "ok", "reason": None}

    unit.latitude = None
    unit.longitude = None
    unit.geocoded_at = None
    session.add(unit)
    if st == "skipped":
        return {"status": "skipped", "reason": reason or "provider_unavailable"}
    return {"status": "failed", "reason": reason or "provider_error"}
