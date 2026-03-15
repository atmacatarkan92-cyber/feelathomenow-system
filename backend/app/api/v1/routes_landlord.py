"""
Landlord portal API: scoped to the authenticated landlord only.
Uses get_current_landlord (role=landlord + resolve Landlord by user_id).
Read-only; all data filtered by landlord.id.
"""

from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select

from db.database import get_session
from db.models import User, Landlord, Property, Unit, Tenancy, Invoice
from auth.dependencies import get_current_landlord
from app.services.invoice_service import _invoice_to_api


router = APIRouter(prefix="/api/landlord", tags=["landlord-portal"])


def _property_to_dict(p: Property) -> dict:
    return {
        "id": str(p.id),
        "landlord_id": getattr(p, "landlord_id", None),
        "title": getattr(p, "title", "") or "",
        "street": getattr(p, "street", None),
        "house_number": getattr(p, "house_number", None),
        "zip_code": getattr(p, "zip_code", None),
        "city": getattr(p, "city", None),
        "country": getattr(p, "country", "CH"),
        "lat": getattr(p, "lat", None),
        "lng": getattr(p, "lng", None),
        "status": getattr(p, "status", "active"),
        "notes": getattr(p, "notes", None),
        "created_at": p.created_at.isoformat() if getattr(p, "created_at", None) else None,
        "updated_at": p.updated_at.isoformat() if getattr(p, "updated_at", None) else None,
        "deleted_at": p.deleted_at.isoformat() if getattr(p, "deleted_at", None) and p.deleted_at else None,
    }


def _unit_to_dict(u: Unit, property_title: Optional[str] = None) -> dict:
    return {
        "id": str(u.id),
        "unitId": str(u.id),
        "name": u.title,
        "title": u.title,
        "address": getattr(u, "address", "") or "",
        "city": getattr(u, "city", "") or "",
        "city_id": getattr(u, "city_id", None),
        "type": getattr(u, "type", None),
        "rooms": getattr(u, "rooms", 0),
        "property_id": getattr(u, "property_id", None),
        "property_title": property_title,
        "created_at": u.created_at.isoformat() if getattr(u, "created_at", None) else None,
    }


def _tenancy_to_dict(t: Tenancy) -> dict:
    return {
        "id": str(t.id),
        "tenant_id": str(t.tenant_id),
        "room_id": str(t.room_id),
        "unit_id": str(t.unit_id),
        "move_in_date": t.move_in_date.isoformat() if t.move_in_date else None,
        "move_out_date": t.move_out_date.isoformat() if t.move_out_date else None,
        "rent_chf": float(t.rent_chf),
        "deposit_chf": float(t.deposit_chf) if t.deposit_chf is not None else None,
        "status": t.status.value if hasattr(t.status, "value") else str(t.status),
        "created_at": t.created_at.isoformat() if getattr(t, "created_at", None) else None,
    }


@router.get("/me")
def landlord_me(user_landlord: Tuple[User, Landlord] = Depends(get_current_landlord)):
    """Landlord profile: user + landlord record. Scoped to current landlord only."""
    user, landlord = user_landlord
    role_str = getattr(user.role, "value", user.role) if getattr(user, "role", None) is not None else ""
    return {
        "user_id": str(user.id),
        "landlord_id": str(landlord.id),
        "full_name": user.full_name or landlord.contact_name or "",
        "email": user.email or landlord.email or "",
        "company_name": landlord.company_name or "",
        "contact_name": landlord.contact_name or "",
        "phone": landlord.phone or "",
        "role": role_str,
    }


@router.get("/properties", response_model=List[dict])
def landlord_list_properties(user_landlord: Tuple[User, Landlord] = Depends(get_current_landlord)):
    """List properties for the current landlord. Scoped by Property.landlord_id == current_landlord.id."""
    _, landlord = user_landlord
    session = get_session()
    try:
        q = (
            select(Property)
            .where(Property.landlord_id == str(landlord.id))
            .order_by(Property.title)
        )
        properties = list(session.exec(q).all())
        return [_property_to_dict(p) for p in properties]
    finally:
        session.close()


@router.get("/properties/{property_id}", response_model=dict)
def landlord_get_property(
    property_id: str,
    user_landlord: Tuple[User, Landlord] = Depends(get_current_landlord),
):
    """Get one property. 404 if not found or not owned by current landlord."""
    _, landlord = user_landlord
    session = get_session()
    try:
        prop = session.get(Property, property_id)
        if not prop or str(prop.landlord_id) != str(landlord.id):
            raise HTTPException(status_code=404, detail="Property not found")
        return _property_to_dict(prop)
    finally:
        session.close()


@router.get("/units", response_model=List[dict])
def landlord_list_units(
    property_id: Optional[str] = None,
    user_landlord: Tuple[User, Landlord] = Depends(get_current_landlord),
):
    """List units for the current landlord's properties. Optional ?property_id= (must belong to landlord)."""
    _, landlord = user_landlord
    session = get_session()
    try:
        # Resolve landlord's property ids
        q_props = select(Property.id).where(Property.landlord_id == str(landlord.id))
        landlord_property_ids = [str(row) for row in session.exec(q_props).all()]
        if property_id is not None:
            if property_id not in landlord_property_ids:
                return []
            landlord_property_ids = [property_id]
        if not landlord_property_ids:
            return []
        q = (
            select(Unit, Property)
            .select_from(Unit)
            .join(Property, Unit.property_id == Property.id)
            .where(Unit.property_id.in_(landlord_property_ids))
            .order_by(Unit.title)
        )
        rows = session.exec(q).all()
        return [_unit_to_dict(u, p.title if p else None) for u, p in rows]
    finally:
        session.close()


@router.get("/tenancies", response_model=List[dict])
def landlord_list_tenancies(
    user_landlord: Tuple[User, Landlord] = Depends(get_current_landlord),
):
    """List tenancies for units belonging to the current landlord. Scope: Unit.property_id -> Property.landlord_id."""
    _, landlord = user_landlord
    session = get_session()
    try:
        q_props = select(Property.id).where(Property.landlord_id == str(landlord.id))
        landlord_property_ids = [str(row) for row in session.exec(q_props).all()]
        if not landlord_property_ids:
            return []
        q_units = select(Unit.id).where(Unit.property_id.in_(landlord_property_ids))
        landlord_unit_ids = [str(row) for row in session.exec(q_units).all()]
        if not landlord_unit_ids:
            return []
        q = (
            select(Tenancy)
            .where(Tenancy.unit_id.in_(landlord_unit_ids))
            .order_by(Tenancy.move_in_date.desc())
        )
        tenancies = list(session.exec(q).all())
        return [_tenancy_to_dict(t) for t in tenancies]
    finally:
        session.close()


@router.get("/invoices", response_model=List[dict])
def landlord_list_invoices(
    user_landlord: Tuple[User, Landlord] = Depends(get_current_landlord),
):
    """List invoices for the current landlord's units. Scope: Landlord -> Property -> Unit -> Invoice."""
    _, landlord = user_landlord
    session = get_session()
    try:
        q_props = select(Property.id).where(Property.landlord_id == str(landlord.id))
        landlord_property_ids = [str(row) for row in session.exec(q_props).all()]
        if not landlord_property_ids:
            return []
        q_units = select(Unit.id).where(Unit.property_id.in_(landlord_property_ids))
        landlord_unit_ids = [str(row) for row in session.exec(q_units).all()]
        if not landlord_unit_ids:
            return []
        stmt = (
            select(Invoice)
            .where(Invoice.unit_id.in_(landlord_unit_ids))
            .order_by(Invoice.issue_date.desc())
        )
        rows = session.exec(stmt).all()
        return [_invoice_to_api(inv) for inv in rows]
    finally:
        session.close()
