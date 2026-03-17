"""
Invoice service: list, get, update status, mark paid/unpaid using the Invoice model.
Used by API routes and invoice generation.
"""

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from sqlmodel import select

from db.models import Invoice


def effective_status(db_status: str, due_date: date) -> str:
    """Derive API status: paid | overdue | unpaid."""
    s = (db_status or "").strip().lower()
    if s == "paid":
        return "paid"
    if due_date and due_date < date.today():
        return "overdue"
    return "unpaid"


def _invoice_to_api(inv: Invoice) -> Dict[str, Any]:
    """Map Invoice model to API response shape."""
    due = inv.due_date
    if hasattr(due, "date"):
        due = due.date() if hasattr(due, "date") else due
    eff = effective_status(inv.status, due)
    paid_at = None
    if inv.paid_at:
        paid_at = inv.paid_at.isoformat() if hasattr(inv.paid_at, "isoformat") else str(inv.paid_at)
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "amount": float(inv.amount),
        "currency": inv.currency,
        "status": eff,
        "issue_date": str(inv.issue_date),
        "due_date": str(inv.due_date),
        "paid_at": paid_at,
        "payment_method": inv.payment_method,
        "payment_reference": inv.payment_reference,
        "tenant_id": str(inv.tenant_id) if inv.tenant_id is not None else None,
        "tenancy_id": str(inv.tenancy_id) if inv.tenancy_id is not None else None,
    }


def list_invoices(session, skip: int = 0, limit: int = 50) -> tuple[List[Dict[str, Any]], int]:
    """Return invoices as API-shaped dicts, ordered by issue_date desc, with basic pagination."""
    base_stmt = select(Invoice).order_by(Invoice.issue_date.desc())
    all_rows = session.exec(base_stmt).all()
    total = len(all_rows)
    paged_rows = session.exec(base_stmt.offset(skip).limit(limit)).all()
    items = [_invoice_to_api(inv) for inv in paged_rows]
    return items, total


def get_invoice(session, invoice_id: int) -> Optional[Invoice]:
    """Return Invoice by id or None."""
    return session.get(Invoice, invoice_id)


def update_invoice_status(session, invoice_id: int, status: str) -> Optional[Dict[str, Any]]:
    """Set invoice status; return API-shaped dict or None if not found."""
    inv = session.get(Invoice, invoice_id)
    if not inv:
        return None
    inv.status = status
    session.add(inv)
    session.commit()
    session.refresh(inv)
    return _invoice_to_api(inv)


def mark_invoice_paid(
    session,
    invoice_id: int,
    payment_method: Optional[str] = None,
    payment_reference: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Set status=paid, paid_at=now; return API-shaped dict or None if not found."""
    inv = session.get(Invoice, invoice_id)
    if not inv:
        return None
    inv.status = "paid"
    inv.paid_at = datetime.now(timezone.utc)
    inv.payment_method = payment_method
    inv.payment_reference = payment_reference
    session.add(inv)
    session.commit()
    session.refresh(inv)
    return _invoice_to_api(inv)


def mark_invoice_unpaid(session, invoice_id: int) -> Optional[Dict[str, Any]]:
    """Set status=unpaid, clear paid_at and payment fields; return API-shaped dict or None."""
    inv = session.get(Invoice, invoice_id)
    if not inv:
        return None
    inv.status = "unpaid"
    inv.paid_at = None
    inv.payment_method = None
    inv.payment_reference = None
    session.add(inv)
    session.commit()
    session.refresh(inv)
    return _invoice_to_api(inv)
