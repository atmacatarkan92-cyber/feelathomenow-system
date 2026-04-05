"""
Persistent short unit codes: APT-001 / CL-002 / UNIT-001 per organization.

Uniqueness: (organization_id, short_unit_id). Allocation is sequential per prefix within org.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from db.models import Unit


def _exec(session, stmt):
    """SQLModel Session uses .exec(); SQLAlchemy Session (e.g. Alembic) uses .execute()."""
    if hasattr(session, "exec"):
        return session.exec(stmt)
    res = session.execute(stmt)
    if hasattr(res, "scalars"):
        return res.scalars()
    return res


def unit_type_to_prefix(unit_type: Optional[str]) -> str:
    """
    Map unit.type to a short prefix. Align with product rules:
    - Co-Living variants -> CL
    - Apartment / Business Apartments -> APT
    - anything else -> UNIT
    """
    if not unit_type or not str(unit_type).strip():
        return "UNIT"
    raw = str(unit_type).strip()
    compact = "".join(raw.lower().split())
    for ch in ("\u2011", "\u2013", "\u2010", "\u2012", "\u2212", "-"):
        compact = compact.replace(ch, "")
    if "coliving" in compact or raw == "Co-Living":
        return "CL"
    low = raw.lower()
    if "apartment" in low or raw in ("Apartment", "Business Apartments"):
        return "APT"
    return "UNIT"


def format_short_unit_code(prefix: str, seq: int) -> str:
    return f"{prefix}-{seq:03d}"


def _max_seq_for_prefix_in_org(session: Session, org_id: str, prefix: str) -> int:
    stmt = select(Unit).where(Unit.organization_id == org_id)
    rows = _exec(session, stmt).all()
    pat = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    m = 0
    for u in rows:
        sid = getattr(u, "short_unit_id", None)
        if not sid:
            continue
        mo = pat.match(str(sid).strip())
        if mo:
            m = max(m, int(mo.group(1)))
    return m


def allocate_next_short_unit_id(session: Session, org_id: str, unit_type: Optional[str]) -> str:
    """Next free code for org + type prefix (e.g. APT-004). Not concurrency-safe alone; retry on unique violation."""
    prefix = unit_type_to_prefix(unit_type)
    n = _max_seq_for_prefix_in_org(session, org_id, prefix) + 1
    return format_short_unit_code(prefix, n)


def backfill_all_units(session: Session) -> None:
    """
    One-time migration: assign deterministic short_unit_id per org, grouped by type prefix,
    stable order: created_at, id.
    """
    units = list(
        _exec(
            session,
            select(Unit).order_by(Unit.organization_id, Unit.created_at, Unit.id),
        ).all()
    )
    from collections import defaultdict

    by_org: dict[str, list[Unit]] = defaultdict(list)
    for u in units:
        by_org[str(u.organization_id)].append(u)

    for _org_id, rows in by_org.items():
        buckets: dict[str, list[Unit]] = defaultdict(list)
        for u in rows:
            buckets[unit_type_to_prefix(u.type)].append(u)
        for prefix, bucket in buckets.items():
            bucket.sort(key=lambda x: (x.created_at or datetime.min, x.id))
            for i, u in enumerate(bucket, start=1):
                u.short_unit_id = format_short_unit_code(prefix, i)
                session.add(u)
