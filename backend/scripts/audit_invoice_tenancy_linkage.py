#!/usr/bin/env python3
"""
Global audit: classify invoice → tenancy linkage without app RLS / request context.

**Requires MIGRATE_DATABASE_URL** (privileged role; bypasses RLS so all org rows are visible).
Do not use DATABASE_URL alone for this script in production — use the migration/superuser URL.

Matching order (strict):
  1) If invoices.tenancy_id is set and resolves to a Tenancy in the same organization → ALREADY_LINKED
  2) Else candidate tenancies: same organization_id, then narrow by tenant_id / room_id / unit_id when present
  3) Mandatory date-range filter when inferring tenancy_id (missing or invalid link):
       reference_date = issue_date if present else due_date
       Tenancy matches iff: move_in_date <= reference_date
         AND (move_out_date IS NULL OR reference_date <= move_out_date)
     Without a valid reference date, inference cannot be RECOVERABLE → NO_REFERENCE_DATE / AMBIGUOUS
  4) RECOVERABLE only if exactly one candidate remains after date filtering
  5) Multiple candidates → AMBIGUOUS; no structural candidates → ORPHAN; structural but none pass date → DATE_NO_MATCH

Run from backend:
  MIGRATE_DATABASE_URL=... python -m scripts.audit_invoice_tenancy_linkage
  MIGRATE_DATABASE_URL=... python -m scripts.audit_invoice_tenancy_linkage --organization-id <uuid>
  MIGRATE_DATABASE_URL=... python -m scripts.audit_invoice_tenancy_linkage --apply  # write tenancy_id only for RECOVERABLE
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import date
from enum import Enum
from typing import Optional

from sqlalchemy import create_engine
from sqlmodel import Session, select

from db.database import get_migration_database_url
from db.models import Invoice, Tenancy


class Classification(str, Enum):
    ALREADY_LINKED = "ALREADY_LINKED"  # tenancy_id set and valid
    RECOVERABLE = "RECOVERABLE"  # exactly one inferred tenancy (dry-run or --apply)
    AMBIGUOUS = "AMBIGUOUS"  # multiple candidates after date filter (or cannot disambiguate)
    ORPHAN = "ORPHAN"  # no structural candidates (filters too strict or no rows)
    DATE_NO_MATCH = "DATE_NO_MATCH"  # structural candidates exist but none in date range
    NO_REFERENCE_DATE = "NO_REFERENCE_DATE"  # issue_date and due_date both missing
    INVALID_LINK = "INVALID_LINK"  # tenancy_id set but no matching tenancy / org mismatch


def _require_privileged_migration_url():
    """
    This audit must not use the app DATABASE_URL alone: RLS would hide rows.
    Require explicit MIGRATE_DATABASE_URL, then use get_migration_database_url().
    """
    if not os.getenv("MIGRATE_DATABASE_URL") or not str(os.getenv("MIGRATE_DATABASE_URL")).strip():
        print(
            "ERROR: Set MIGRATE_DATABASE_URL to a privileged connection (bypasses RLS for global audit).",
            file=sys.stderr,
        )
        sys.exit(1)
    u = get_migration_database_url()
    if u is None:
        print("ERROR: get_migration_database_url() returned None.", file=sys.stderr)
        sys.exit(1)
    return u


def _reference_date(inv: Invoice) -> Optional[date]:
    if inv.issue_date is not None:
        return inv.issue_date
    if inv.due_date is not None:
        return inv.due_date
    return None


def _date_matches_tenancy(t: Tenancy, ref: date) -> bool:
    """move_in <= ref <= move_out OR move_out IS NULL (still active)."""
    if t.move_in_date and ref < t.move_in_date:
        return False
    if t.move_out_date is None:
        return True
    return ref <= t.move_out_date


def _classify_invoice(session: Session, inv: Invoice) -> tuple[Classification, Optional[str], int]:
    """
    Returns (classification, suggested_tenancy_id or None, candidate_count_after_date).
    """
    tid_existing = inv.tenancy_id
    if tid_existing:
        t = session.get(Tenancy, str(tid_existing))
        if t is None:
            return Classification.INVALID_LINK, None, 0
        if str(t.organization_id) != str(inv.organization_id):
            return Classification.INVALID_LINK, None, 0
        return Classification.ALREADY_LINKED, str(t.id), 1

    ref = _reference_date(inv)
    if ref is None:
        return Classification.NO_REFERENCE_DATE, None, 0

    q = select(Tenancy).where(Tenancy.organization_id == inv.organization_id)
    if inv.tenant_id:
        q = q.where(Tenancy.tenant_id == str(inv.tenant_id))
    if inv.room_id:
        q = q.where(Tenancy.room_id == str(inv.room_id))
    if inv.unit_id:
        q = q.where(Tenancy.unit_id == str(inv.unit_id))

    structural = list(session.exec(q).all())
    if not structural:
        return Classification.ORPHAN, None, 0

    dated = [t for t in structural if _date_matches_tenancy(t, ref)]
    n = len(dated)
    if n == 0:
        return Classification.DATE_NO_MATCH, None, 0
    if n > 1:
        return Classification.AMBIGUOUS, None, n
    return Classification.RECOVERABLE, str(dated[0].id), 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit invoice ↔ tenancy linkage (privileged DB).")
    parser.add_argument(
        "--organization-id",
        default=None,
        help="Only process invoices for this organization_id",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Set tenancy_id on invoices classified RECOVERABLE (destructive)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max invoices to process (debug)",
    )
    args = parser.parse_args()

    url = _require_privileged_migration_url()
    engine = create_engine(url, pool_pre_ping=True, connect_args={"client_encoding": "utf8"})

    counts: dict[str, int] = {c.value: 0 for c in Classification}

    with Session(engine) as session:
        q = select(Invoice).order_by(Invoice.id)
        if args.organization_id:
            q = q.where(Invoice.organization_id == str(args.organization_id).strip())
        rows = list(session.exec(q).all())
        if args.limit is not None:
            rows = rows[: max(0, args.limit)]

        updates: list[tuple[int, str]] = []
        for inv in rows:
            cls, suggested, _n = _classify_invoice(session, inv)
            counts[cls.value] = counts.get(cls.value, 0) + 1
            if cls == Classification.RECOVERABLE and suggested and args.apply:
                updates.append((inv.id, suggested))

        if args.apply and updates:
            for inv_id, tenancy_id in updates:
                inv = session.get(Invoice, inv_id)
                if inv is not None:
                    inv.tenancy_id = tenancy_id
            session.commit()
            print(f"Applied {len(updates)} tenancy_id updates.")
        elif args.apply:
            print("No RECOVERABLE rows to update.")

    print("Summary (invoice count per classification):")
    for k in sorted(counts.keys()):
        if counts[k]:
            print(f"  {k}: {counts[k]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
