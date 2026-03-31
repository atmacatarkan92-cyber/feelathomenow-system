"""
Admin property managers (Bewirtschafter): list, get, create, update, units.
Protected by require_roles("admin", "manager").
"""

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlmodel import select

from auth.dependencies import get_current_organization, get_db_session, require_roles
from db.models import Landlord, Property, PropertyManager, Unit
from app.api.v1.routes_admin_units import _unit_to_dict
from app.core.rate_limit import limiter


router = APIRouter(prefix="/api/admin", tags=["admin-property-managers"])


def _assert_landlord_in_org(session, landlord_id: Optional[str], org_id: str) -> None:
    if not landlord_id:
        return
    ll = session.get(Landlord, landlord_id)
    if not ll or str(getattr(ll, "organization_id", "")) != org_id:
        raise HTTPException(status_code=400, detail="Invalid landlord reference")


def _pm_status(p: PropertyManager) -> str:
    s = (getattr(p, "status", None) or "active").strip().lower()
    return "inactive" if s == "inactive" else "active"


def _pm_to_dict(p: PropertyManager) -> dict:
    return {
        "id": str(p.id),
        "landlord_id": getattr(p, "landlord_id", None),
        "name": (getattr(p, "name", None) or "").strip(),
        "email": getattr(p, "email", None),
        "phone": getattr(p, "phone", None),
        "status": _pm_status(p),
        "created_at": p.created_at.isoformat() if getattr(p, "created_at", None) else None,
    }


class PropertyManagerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    email: Optional[str] = None
    phone: Optional[str] = None
    landlord_id: Optional[str] = None
    status: Optional[Literal["active", "inactive"]] = "active"


class PropertyManagerPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=500)
    email: Optional[str] = None
    phone: Optional[str] = None
    landlord_id: Optional[str] = None
    status: Optional[Literal["active", "inactive"]] = None


@router.get("/property-managers", response_model=List[dict])
def admin_list_property_managers(
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    rows = list(
        session.exec(
            select(PropertyManager)
            .where(PropertyManager.organization_id == org_id)
            .order_by(PropertyManager.name)
        ).all()
    )
    return [_pm_to_dict(p) for p in rows]


@router.get("/property-managers/{pm_id}", response_model=dict)
def admin_get_property_manager(
    pm_id: str,
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    pm = session.get(PropertyManager, pm_id)
    if not pm or str(getattr(pm, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Property manager not found")
    return _pm_to_dict(pm)


@router.get("/property-managers/{pm_id}/units", response_model=List[dict])
def admin_list_property_manager_units(
    pm_id: str,
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """Units with property_manager_id == pm_id (org-scoped)."""
    pm = session.get(PropertyManager, pm_id)
    if not pm or str(getattr(pm, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Property manager not found")
    stmt = (
        select(Unit, Property)
        .select_from(Unit)
        .outerjoin(Property, Unit.property_id == Property.id)
        .where(Unit.organization_id == org_id)
        .where(Unit.property_manager_id == pm_id)
        .order_by(Unit.title)
    )
    rows = list(session.exec(stmt).all())
    return [_unit_to_dict(u, p.title if p else None) for u, p in rows]


@router.post("/property-managers", response_model=dict)
@limiter.limit("10/minute")
def admin_create_property_manager(
    request: Request,
    body: PropertyManagerCreate,
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    _assert_landlord_in_org(session, body.landlord_id, org_id)
    st = (body.status or "active").strip().lower()
    if st not in ("active", "inactive"):
        st = "active"
    pm = PropertyManager(
        organization_id=org_id,
        name=name,
        email=(body.email or "").strip() or None,
        phone=(body.phone or "").strip() or None,
        landlord_id=body.landlord_id or None,
        status=st,
    )
    session.add(pm)
    session.commit()
    session.refresh(pm)
    return _pm_to_dict(pm)


@router.patch("/property-managers/{pm_id}", response_model=dict)
@limiter.limit("20/minute")
def admin_patch_property_manager(
    request: Request,
    pm_id: str,
    body: PropertyManagerPatch,
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    pm = session.get(PropertyManager, pm_id)
    if not pm or str(getattr(pm, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Property manager not found")
    data = body.model_dump(exclude_unset=True)
    if "landlord_id" in data:
        lid = data["landlord_id"] if data["landlord_id"] else None
        _assert_landlord_in_org(session, lid, org_id)
        data["landlord_id"] = lid
    if "name" in data and data["name"] is not None:
        n = str(data["name"]).strip()
        if not n:
            raise HTTPException(status_code=400, detail="Name must not be empty")
        data["name"] = n
    if "email" in data:
        data["email"] = (data["email"] or "").strip() or None
    if "phone" in data:
        data["phone"] = (data["phone"] or "").strip() or None
    if "status" in data and data["status"] is not None:
        st = str(data["status"]).strip().lower()
        if st not in ("active", "inactive"):
            raise HTTPException(status_code=400, detail="status must be active or inactive")
        data["status"] = st
    for k, v in data.items():
        if hasattr(pm, k):
            setattr(pm, k, v)
    session.add(pm)
    session.commit()
    session.refresh(pm)
    return _pm_to_dict(pm)
