"""
Invoice API: list, status update, mark paid/unpaid, PDF download, generate.
Uses invoice_service and Invoice model. Protected by require_roles.
"""

import os
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy import or_
from sqlmodel import select

from db.database import get_session
from auth.dependencies import require_roles
from app.core.rate_limit import limiter
from app.services.invoice_service import (
    _invoice_to_api,
    get_invoice,
    update_invoice_status,
    mark_invoice_paid,
    mark_invoice_unpaid,
)
from db.models import Invoice
from db.organization import get_or_create_default_organization


router = APIRouter(prefix="/api", tags=["invoices"])


@router.get("/invoices")
def get_invoices_route(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _=Depends(require_roles("admin", "manager")),
):
    """List all invoices (API-shaped with effective status) with basic pagination."""
    session = get_session()
    try:
        org = get_or_create_default_organization(session)
        org_id = str(org.id)
        _total_rows = session.exec(
            select(func.count())
            .select_from(Invoice)
            .where(Invoice.organization_id == org_id)
        ).all()
        total = int(_total_rows[0]) if _total_rows else 0
        stmt = (
            select(Invoice)
            .where(Invoice.organization_id == org_id)
            .order_by(Invoice.issue_date.desc())
            .offset(skip)
            .limit(limit)
        )
        rows = session.exec(stmt).all()
        items = [_invoice_to_api(inv) for inv in rows]
        return {
            "items": items,
            "total": total,
            "skip": skip,
            "limit": limit,
        }
    finally:
        session.close()


@router.put("/invoices/{invoice_id}/status")
def update_invoice_status_route(
    invoice_id: int,
    status: str,
    _=Depends(require_roles("admin", "manager")),
):
    """Update invoice status (e.g. open, overdue, cancelled)."""
    session = get_session()
    try:
        result = update_invoice_status(session, invoice_id, status)
        if result is None:
            raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
        return result
    finally:
        session.close()


@router.patch("/admin/invoices/{invoice_id}/mark-paid")
@limiter.limit("10/minute")
def mark_invoice_paid_route(
    request: Request,
    invoice_id: int,
    body: Optional[dict] = Body(default=None),
    _=Depends(require_roles("admin", "manager")),
):
    """Set status=paid, paid_at=now; optional payment_method and payment_reference."""
    session = get_session()
    try:
        payment_method = body.get("payment_method") if body else None
        payment_reference = body.get("payment_reference") if body else None
        result = mark_invoice_paid(session, invoice_id, payment_method, payment_reference)
        if result is None:
            raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
        return result
    finally:
        session.close()


@router.patch("/admin/invoices/{invoice_id}/mark-unpaid")
@limiter.limit("10/minute")
def mark_invoice_unpaid_route(
    request: Request,
    invoice_id: int,
    _=Depends(require_roles("admin", "manager")),
):
    """Set status=unpaid, clear paid_at and payment fields."""
    session = get_session()
    try:
        result = mark_invoice_unpaid(session, invoice_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
        return result
    finally:
        session.close()


@router.get("/invoices/{invoice_id}/pdf")
def download_invoice_pdf_route(
    invoice_id: int,
    _=Depends(require_roles("admin", "manager")),
):
    """Download invoice PDF by id (file must exist in invoices/ folder)."""
    session = get_session()
    try:
        inv = get_invoice(session, invoice_id)
        if not inv or not inv.invoice_number:
            raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
        file_path = f"invoices/{inv.invoice_number}.pdf"
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="PDF nicht gefunden")
        return FileResponse(
            path=file_path,
            media_type="application/pdf",
            filename=f"{inv.invoice_number}.pdf",
        )
    finally:
        session.close()


@router.post("/admin/invoices/generate")
@limiter.limit("10/minute")
def generate_invoices_route(
    request: Request,
    body: dict = Body(..., description="year and month"),
    _=Depends(require_roles("admin", "manager")),
):
    """Generate monthly invoices from active tenancies; prorate; skip duplicates."""
    year = body.get("year")
    month = body.get("month")
    if year is None or month is None:
        raise HTTPException(status_code=400, detail="year and month are required")
    try:
        year = int(year)
        month = int(month)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="year and month must be integers")
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="month must be 1-12")
    session = get_session()
    try:
        from app.services.invoice_generation_service import generate_monthly_invoices
        result = generate_monthly_invoices(session, year, month)
        return result
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()
