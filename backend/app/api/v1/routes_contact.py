import logging
import os
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlmodel import Session as SQLModelSession

from auth.dependencies import get_current_organization, get_db_session, require_roles
from db.database import engine
from db.models import Inquiry, Listing, Unit
from db.rls import apply_pg_inquiry_id_lookup
from email_service import send_contact_notification, EmailServiceError
from models import ContactInquiryCreate, ContactResponse

router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)

NOTIFICATION_EMAIL = os.environ.get("NOTIFICATION_EMAIL", "info@feelathomenow.ch")


@router.post("/contact", response_model=ContactResponse)
def submit_contact(
    inquiry: ContactInquiryCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_session),
):
    """
    Public contact intake (unauthenticated). Persists Inquiry rows without organization_id;
    not mixed into org-scoped admin listings. See GET /api/admin/inquiries for org filtering.
    """
    if engine is None:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable.")
    org_id_for_inquiry = None
    if inquiry.apartment_id:
        listing = db.get(Listing, inquiry.apartment_id)
        if listing:
            unit = db.get(Unit, listing.unit_id)
            if unit and getattr(unit, "organization_id", None):
                org_id_for_inquiry = str(unit.organization_id)

    if inquiry.apartment_id and org_id_for_inquiry is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or unknown apartment listing reference.",
        )

    obj = Inquiry(
        name=inquiry.name,
        email=inquiry.email,
        message=inquiry.message,
        phone=inquiry.phone or None,
        company=inquiry.company or None,
        language=inquiry.language or "de",
        apartment_id=inquiry.apartment_id,
        organization_id=org_id_for_inquiry,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    inquiry_id = obj.id
    background_tasks.add_task(send_email_notification_sync, inquiry_id)
    return ContactResponse(
        success=True,
        message="Vielen Dank für Ihre Anfrage. Wir melden uns bald bei Ihnen.",
    )


def send_email_notification_sync(inquiry_id: str):
    """Background task: send notification email and mark inquiry.email_sent in PostgreSQL."""
    if engine is None:
        return
    with SQLModelSession(engine) as db:
        apply_pg_inquiry_id_lookup(db, inquiry_id)
        try:
            inquiry = db.get(Inquiry, inquiry_id)
            if not inquiry:
                return
            try:
                send_contact_notification(
                    recipient_email=NOTIFICATION_EMAIL,
                    contact_name=inquiry.name,
                    contact_email=inquiry.email,
                    contact_phone=inquiry.phone or "",
                    contact_company=inquiry.company or "",
                    contact_message=inquiry.message,
                    language=inquiry.language or "de",
                )
            except EmailServiceError as e:
                logger.error(str(e))
                return
            inquiry.email_sent = True
            db.add(inquiry)
            db.commit()
        finally:
            apply_pg_inquiry_id_lookup(db, None)


@router.get("/admin/inquiries", response_model=List[dict])
def get_inquiries(
    _: None = Depends(require_roles("admin", "manager")),
    org_id: str = Depends(get_current_organization),
    db: Session = Depends(get_db_session),
):
    """
    Organization-scoped: only inquiries linked to a listing whose unit belongs to the
    current admin/manager organization (Inquiry.apartment_id -> Listing -> Unit).

    Rows with apartment_id IS NULL are omitted (public contact intake; not attributable to a
    listing/org in this query). Operational follow-up: review with
    SELECT id, created_at FROM inquiries WHERE apartment_id IS NULL;
    """
    if engine is None:
        raise HTTPException(status_code=503, detail="PostgreSQL is not configured.")
    from sqlmodel import select

    stmt = (
        select(Inquiry)
        .join(Listing, Inquiry.apartment_id == Listing.id)
        .join(Unit, Listing.unit_id == Unit.id)
        .where(Unit.organization_id == org_id)
        .order_by(Inquiry.created_at.desc())
        .limit(500)
    )
    rows = db.exec(stmt).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "email": r.email,
            "message": r.message,
            "phone": r.phone,
            "company": r.company,
            "language": r.language,
            "apartment_id": r.apartment_id,
            "email_sent": r.email_sent,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
