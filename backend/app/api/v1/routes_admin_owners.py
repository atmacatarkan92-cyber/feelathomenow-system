"""
Admin owners (Eigentümer): list, get, create, update.
Protected by require_roles("admin", "manager").
"""

from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlmodel import select

from auth.dependencies import get_current_organization, get_db_session, require_roles
from app.core.rate_limit import limiter
from db.models import Owner


router = APIRouter(prefix="/api/admin", tags=["admin-owners"])


def _owner_status(o: Owner) -> str:
    s = (getattr(o, "status", None) or "active").strip().lower()
    return "inactive" if s == "inactive" else "active"


def _owner_to_dict(o: Owner) -> dict:
    return {
        "id": str(o.id),
        "name": (getattr(o, "name", None) or "").strip(),
        "email": getattr(o, "email", None),
        "phone": getattr(o, "phone", None),
        "status": _owner_status(o),
        "notes": getattr(o, "notes", None),
        "created_at": o.created_at.isoformat() if getattr(o, "created_at", None) else None,
        "updated_at": o.updated_at.isoformat()
        if getattr(o, "updated_at", None)
        else None,
    }


class OwnerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[Literal["active", "inactive"]] = "active"
    notes: Optional[str] = None


class OwnerPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=500)
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[Literal["active", "inactive"]] = None
    notes: Optional[str] = None


@router.get("/owners", response_model=List[dict])
def admin_list_owners(
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    rows = list(
        session.exec(
            select(Owner)
            .where(Owner.organization_id == org_id)
            .order_by(Owner.name)
        ).all()
    )
    return [_owner_to_dict(o) for o in rows]


@router.get("/owners/{owner_id}", response_model=dict)
def admin_get_owner(
    owner_id: str,
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    o = session.get(Owner, owner_id)
    if not o or str(getattr(o, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Owner not found")
    return _owner_to_dict(o)


@router.post("/owners", response_model=dict)
@limiter.limit("10/minute")
def admin_create_owner(
    request: Request,
    body: OwnerCreate,
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    st = (body.status or "active").strip().lower()
    if st not in ("active", "inactive"):
        st = "active"
    now = datetime.utcnow()
    o = Owner(
        organization_id=org_id,
        name=name,
        email=(body.email or "").strip() or None,
        phone=(body.phone or "").strip() or None,
        status=st,
        notes=(body.notes or "").strip() or None,
        created_at=now,
        updated_at=now,
    )
    session.add(o)
    session.commit()
    session.refresh(o)
    return _owner_to_dict(o)


@router.patch("/owners/{owner_id}", response_model=dict)
@limiter.limit("20/minute")
def admin_patch_owner(
    request: Request,
    owner_id: str,
    body: OwnerPatch,
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    o = session.get(Owner, owner_id)
    if not o or str(getattr(o, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Owner not found")
    data = body.model_dump(exclude_unset=True)
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
    if "notes" in data and data["notes"] is not None:
        data["notes"] = (data["notes"] or "").strip() or None
    if data:
        data["updated_at"] = datetime.utcnow()
    for k, v in data.items():
        if hasattr(o, k):
            setattr(o, k, v)
    session.add(o)
    session.commit()
    session.refresh(o)
    return _owner_to_dict(o)
