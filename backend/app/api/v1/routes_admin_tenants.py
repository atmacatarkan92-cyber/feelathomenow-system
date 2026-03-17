"""
Admin tenants: CRUD.
Protected by require_roles("admin", "manager").
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import select

from db.database import get_session
from db.models import Tenant, User
from db.audit import create_audit_log, model_snapshot
from auth.dependencies import require_roles


router = APIRouter(prefix="/api/admin", tags=["admin-tenants"])


def _tenant_to_dict(t: Tenant) -> dict:
    return {
        "id": str(t.id),
        "full_name": getattr(t, "name", "") or "",
        "name": getattr(t, "name", "") or "",
        "email": getattr(t, "email", "") or "",
        "phone": getattr(t, "phone", None),
        "company": getattr(t, "company", None),
        "room_id": getattr(t, "room_id", None),
        "created_at": t.created_at.isoformat() if getattr(t, "created_at", None) else None,
    }


class TenantCreate(BaseModel):
    full_name: Optional[str] = None
    name: Optional[str] = None
    email: str = ""
    phone: Optional[str] = None
    company: Optional[str] = None
    room_id: Optional[str] = None


class TenantPatch(BaseModel):
    full_name: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    room_id: Optional[str] = None


class TenantListResponse(BaseModel):
    items: List[dict]
    total: int
    skip: int
    limit: int


@router.get("/tenants", response_model=TenantListResponse)
def admin_list_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _=Depends(require_roles("admin", "manager")),
):
    """List all tenants."""
    session = get_session()
    try:
        base_query = select(Tenant).order_by(Tenant.name)
        total_rows = session.exec(base_query).all()
        total = len(total_rows)
        paged_rows = session.exec(base_query.offset(skip).limit(limit)).all()
        items = [_tenant_to_dict(t) for t in paged_rows]
        return TenantListResponse(items=items, total=total, skip=skip, limit=limit)
    finally:
        session.close()


@router.post("/tenants", response_model=dict)
def admin_create_tenant(
    body: TenantCreate,
    current_user: User = Depends(require_roles("admin", "manager")),
):
    """Create a new tenant."""
    session = get_session()
    try:
        name = (body.full_name or body.name or "").strip() or "Tenant"
        tenant = Tenant(
            name=name,
            email=body.email or "",
            room_id=body.room_id,
            phone=body.phone,
            company=body.company,
        )
        session.add(tenant)
        create_audit_log(
            session, str(current_user.id), "create", "tenant", str(tenant.id),
            old_values=None, new_values=model_snapshot(tenant),
        )
        session.commit()
        session.refresh(tenant)
        return _tenant_to_dict(tenant)
    finally:
        session.close()


@router.patch("/tenants/{tenant_id}", response_model=dict)
def admin_patch_tenant(
    tenant_id: str,
    body: TenantPatch,
    current_user: User = Depends(require_roles("admin", "manager")),
):
    """Update a tenant (partial)."""
    session = get_session()
    try:
        tenant = session.get(Tenant, tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        old_snapshot = model_snapshot(tenant)
        data = body.model_dump(exclude_unset=True)
        if "full_name" in data and "name" not in data:
            data["name"] = data.pop("full_name")
        elif "name" in data:
            pass
        for k, v in data.items():
            if hasattr(tenant, k):
                setattr(tenant, k, v)
        session.add(tenant)
        create_audit_log(
            session, str(current_user.id), "update", "tenant", str(tenant_id),
            old_values=old_snapshot, new_values=model_snapshot(tenant),
        )
        session.commit()
        session.refresh(tenant)
        return _tenant_to_dict(tenant)
    finally:
        session.close()


@router.delete("/tenants/{tenant_id}")
def admin_delete_tenant(
    tenant_id: str,
    current_user: User = Depends(require_roles("admin", "manager")),
):
    """Delete a tenant."""
    session = get_session()
    try:
        tenant = session.get(Tenant, tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        old_snapshot = model_snapshot(tenant)
        session.delete(tenant)
        create_audit_log(
            session, str(current_user.id), "delete", "tenant", str(tenant_id),
            old_values=old_snapshot, new_values=None,
        )
        session.commit()
        return {"status": "ok", "message": "Tenant deleted"}
    finally:
        session.close()
