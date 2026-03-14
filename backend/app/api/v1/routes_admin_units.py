"""
Admin units and rooms: CRUD + list rooms by unit.
Protected by require_roles("platform_admin", "ops_admin").
"""

from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlmodel import select

from db.database import get_session
from db.models import Unit, Room
from auth.dependencies import require_roles


router = APIRouter(prefix="/api/admin", tags=["admin-units"])


def _unit_to_dict(u: Unit) -> dict:
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
        "created_at": u.created_at.isoformat() if getattr(u, "created_at", None) else None,
    }


def _room_to_dict(r: Room) -> dict:
    price = getattr(r, "price", 0)
    return {
        "id": str(r.id),
        "unit_id": r.unit_id,
        "unitId": r.unit_id,
        "name": r.name,
        "price": price,
        "base_rent_chf": getattr(r, "base_rent_chf", None) or price,
        "floor": getattr(r, "floor", None),
        "is_active": getattr(r, "is_active", True),
    }


class UnitCreate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    address: str = ""
    city: str = ""
    city_id: Optional[str] = None
    type: Optional[str] = None
    rooms: int = 0


class UnitPatch(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    city_id: Optional[str] = None
    type: Optional[str] = None
    rooms: Optional[int] = None


@router.get("/units", response_model=List[dict])
def admin_list_units(
    _=Depends(require_roles("platform_admin", "ops_admin")),
):
    """List all units (listings dropdown + admin pages). Returns [] if table is empty."""
    session = get_session()
    try:
        units = list(session.exec(select(Unit).order_by(Unit.title)).all())
        return [_unit_to_dict(u) for u in units]
    except (OperationalError, ProgrammingError) as e:
        session.rollback()
        msg = str(e).strip() or "database error"
        if "does not exist" in msg or "column" in msg.lower() or "relation" in msg.lower():
            raise HTTPException(
                status_code=503,
                detail=(
                    "Unit table schema may be outdated. Run: python -m scripts.ensure_units_rooms_tenants_columns"
                ),
            ) from e
        raise HTTPException(status_code=503, detail=msg) from e
    finally:
        session.close()


@router.get("/units/{unit_id}", response_model=dict)
def admin_get_unit(
    unit_id: str,
    _=Depends(require_roles("platform_admin", "ops_admin")),
):
    """Get a single unit by id."""
    session = get_session()
    try:
        unit = session.get(Unit, unit_id)
        if not unit:
            raise HTTPException(status_code=404, detail="Unit not found")
        return _unit_to_dict(unit)
    finally:
        session.close()


@router.post("/units", response_model=dict)
def admin_create_unit(
    body: UnitCreate,
    _=Depends(require_roles("platform_admin", "ops_admin")),
):
    """Create a new unit."""
    session = get_session()
    try:
        title = (body.title or body.name or "").strip() or "New Unit"
        unit = Unit(
            title=title,
            address=body.address or "",
            city=body.city or "",
            rooms=body.rooms,
            type=body.type,
            city_id=body.city_id,
        )
        session.add(unit)
        session.commit()
        session.refresh(unit)
        return _unit_to_dict(unit)
    finally:
        session.close()


@router.patch("/units/{unit_id}", response_model=dict)
def admin_patch_unit(
    unit_id: str,
    body: UnitPatch,
    _=Depends(require_roles("platform_admin", "ops_admin")),
):
    """Update a unit (partial)."""
    session = get_session()
    try:
        unit = session.get(Unit, unit_id)
        if not unit:
            raise HTTPException(status_code=404, detail="Unit not found")
        data = body.model_dump(exclude_unset=True)
        if "name" in data and "title" not in data:
            data["title"] = data.pop("name")
        elif "title" in data:
            pass
        for k, v in data.items():
            if hasattr(unit, k):
                setattr(unit, k, v)
        session.add(unit)
        session.commit()
        session.refresh(unit)
        return _unit_to_dict(unit)
    finally:
        session.close()


@router.delete("/units/{unit_id}")
def admin_delete_unit(
    unit_id: str,
    _=Depends(require_roles("platform_admin", "ops_admin")),
):
    """Delete a unit (caller must ensure no dependent listings/rooms)."""
    session = get_session()
    try:
        unit = session.get(Unit, unit_id)
        if not unit:
            raise HTTPException(status_code=404, detail="Unit not found")
        session.delete(unit)
        session.commit()
        return {"status": "ok", "message": "Unit deleted"}
    finally:
        session.close()


@router.get("/units/{unit_id}/rooms", response_model=List[dict])
def admin_list_rooms_for_unit(
    unit_id: str,
    _=Depends(require_roles("platform_admin", "ops_admin")),
):
    """List rooms belonging to the given unit (listings dropdown + admin)."""
    session = get_session()
    try:
        unit = session.get(Unit, unit_id)
        if not unit:
            raise HTTPException(status_code=404, detail="Unit not found")
        rooms = list(
            session.exec(
                select(Room).where(Room.unit_id == unit_id).order_by(Room.name)
            ).all()
        )
        return [_room_to_dict(r) for r in rooms]
    finally:
        session.close()
