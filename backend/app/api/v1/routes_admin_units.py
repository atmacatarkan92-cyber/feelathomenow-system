"""
Admin units and rooms: CRUD + list rooms by unit.
Protected by require_roles("admin", "manager").
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field, field_validator, model_validator

from auth.dependencies import get_current_organization, get_db_session, require_roles
from db.models import User
from app.core.rate_limit import limiter
from app.services import unit_admin_service as uas

router = APIRouter(prefix="/api/admin", tags=["admin-units"])

# Backward compatibility: other admin routes import these helpers from this module
_unit_to_dict = uas.unit_to_dict
load_owner_names_map = uas.load_owner_names_map


ALLOWED_ROOM_STATUS = frozenset({"Frei", "Belegt", "Reserviert"})
ALLOWED_LANDLORD_DEPOSIT_TYPES = frozenset({"bank", "insurance", "cash", "none"})
ALLOWED_UNIT_COST_FREQUENCIES = frozenset({"monthly", "yearly", "one_time"})


class CoLivingRoomInput(BaseModel):
    name: str
    price: int = Field(default=0, ge=0)
    floor: Optional[int] = Field(default=None, ge=0)
    size_m2: Optional[float] = Field(default=None, ge=0)
    status: str = Field(default="Frei")

    @model_validator(mode="after")
    def _normalize(self) -> "CoLivingRoomInput":
        n = self.name.strip()
        if not n:
            raise ValueError("name must not be empty")
        self.name = n
        if self.status not in ALLOWED_ROOM_STATUS:
            raise ValueError(
                f"status must be one of: {', '.join(sorted(ALLOWED_ROOM_STATUS))}"
            )
        return self


class UnitCreate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    address: str = ""
    city: str = ""
    city_id: Optional[str] = None
    type: Optional[str] = None
    rooms: int = Field(default=0, ge=0)
    property_id: Optional[str] = None
    landlord_id: Optional[str] = None
    property_manager_id: Optional[str] = None
    owner_id: Optional[str] = None
    co_living_rooms: Optional[List[CoLivingRoomInput]] = None
    tenant_price_monthly_chf: float = Field(default=0, ge=0)
    landlord_rent_monthly_chf: float = Field(default=0, ge=0)
    utilities_monthly_chf: float = Field(default=0, ge=0)
    cleaning_cost_monthly_chf: float = Field(default=0, ge=0)
    landlord_lease_start_date: Optional[date] = None
    available_from: Optional[date] = None
    occupancy_status: Optional[str] = None
    occupied_rooms: int = Field(default=0, ge=0)
    postal_code: Optional[str] = None
    landlord_deposit_type: Optional[str] = None
    landlord_deposit_amount: Optional[float] = Field(default=None, ge=0)
    landlord_deposit_annual_premium: Optional[float] = Field(default=None, ge=0)
    lease_type: Optional[str] = None
    lease_start_date: Optional[date] = None
    lease_end_date: Optional[date] = None
    notice_given_date: Optional[date] = None
    termination_effective_date: Optional[date] = None
    returned_to_landlord_date: Optional[date] = None
    lease_status: Optional[str] = None
    lease_notes: Optional[str] = None

    @field_validator("landlord_deposit_type", mode="before")
    @classmethod
    def _normalize_landlord_deposit_type_create(cls, v):
        if v is None or v == "":
            return None
        s = str(v).strip().lower()
        if s not in ALLOWED_LANDLORD_DEPOSIT_TYPES:
            raise ValueError(
                "landlord_deposit_type must be one of: bank, insurance, cash, none"
            )
        return s

    @model_validator(mode="after")
    def _co_living_rooms_match_count(self) -> "UnitCreate":
        t = (self.type or "").strip()
        if t == "Co-Living":
            if self.rooms > 0:
                if not self.co_living_rooms or len(self.co_living_rooms) != self.rooms:
                    raise ValueError(
                        "co_living_rooms must have exactly one entry per room (rooms) for Co-Living"
                    )
            elif self.co_living_rooms:
                raise ValueError("co_living_rooms must be omitted when rooms is 0")
        return self


class UnitPatch(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    city_id: Optional[str] = None
    type: Optional[str] = None
    rooms: Optional[int] = Field(default=None, ge=0)
    property_id: Optional[str] = None
    landlord_id: Optional[str] = None
    property_manager_id: Optional[str] = None
    owner_id: Optional[str] = None
    tenant_price_monthly_chf: Optional[float] = Field(default=None, ge=0)
    landlord_rent_monthly_chf: Optional[float] = Field(default=None, ge=0)
    utilities_monthly_chf: Optional[float] = Field(default=None, ge=0)
    cleaning_cost_monthly_chf: Optional[float] = Field(default=None, ge=0)
    landlord_lease_start_date: Optional[date] = None
    available_from: Optional[date] = None
    occupancy_status: Optional[str] = None
    occupied_rooms: Optional[int] = Field(default=None, ge=0)
    postal_code: Optional[str] = None
    landlord_deposit_type: Optional[str] = None
    landlord_deposit_amount: Optional[float] = Field(default=None, ge=0)
    landlord_deposit_annual_premium: Optional[float] = Field(default=None, ge=0)
    lease_type: Optional[str] = None
    lease_start_date: Optional[date] = None
    lease_end_date: Optional[date] = None
    notice_given_date: Optional[date] = None
    termination_effective_date: Optional[date] = None
    returned_to_landlord_date: Optional[date] = None
    lease_status: Optional[str] = None
    lease_notes: Optional[str] = None

    @field_validator("landlord_deposit_type", mode="before")
    @classmethod
    def _normalize_landlord_deposit_type_patch(cls, v):
        if v is None or v == "":
            return None
        s = str(v).strip().lower()
        if s not in ALLOWED_LANDLORD_DEPOSIT_TYPES:
            raise ValueError(
                "landlord_deposit_type must be one of: bank, insurance, cash, none"
            )
        return s


class UnitListResponse(BaseModel):
    items: List[dict]
    total: int
    skip: int
    limit: int


class UnitCostCreateBody(BaseModel):
    cost_type: str
    amount_chf: float = Field(gt=0)
    frequency: Optional[str] = None

    @field_validator("cost_type", mode="before")
    @classmethod
    def _normalize_cost_type_create(cls, v):
        if v is None:
            raise ValueError("cost_type is required")
        s = str(v).strip()
        if not s:
            raise ValueError("cost_type must not be empty")
        return s

    @field_validator("frequency", mode="before")
    @classmethod
    def _normalize_frequency_create(cls, v):
        if v is None or v == "":
            return None
        s = str(v).strip().lower()
        if s not in ALLOWED_UNIT_COST_FREQUENCIES:
            raise ValueError("frequency must be one of: monthly, yearly, one_time")
        return s


class UnitCostPatchBody(BaseModel):
    cost_type: Optional[str] = None
    amount_chf: Optional[float] = None
    frequency: Optional[str] = None

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "UnitCostPatchBody":
        if self.cost_type is None and self.amount_chf is None and self.frequency is None:
            raise ValueError("At least one of cost_type, amount_chf or frequency is required")
        return self

    @field_validator("cost_type", mode="before")
    @classmethod
    def _normalize_cost_type_patch(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            raise ValueError("cost_type must not be empty")
        return s

    @field_validator("frequency", mode="before")
    @classmethod
    def _normalize_frequency_patch(cls, v):
        if v is None:
            return None
        s = str(v).strip().lower()
        if not s:
            return None
        if s not in ALLOWED_UNIT_COST_FREQUENCIES:
            raise ValueError("frequency must be one of: monthly, yearly, one_time")
        return s

    @field_validator("amount_chf")
    @classmethod
    def _amount_positive_if_set(cls, v):
        if v is None:
            return None
        if v <= 0:
            raise ValueError("amount_chf must be positive")
        return v


@router.get("/units", response_model=UnitListResponse)
def admin_list_units(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """List units (listings dropdown + admin pages) with basic pagination."""
    data = uas.list_units(session, org_id, skip=skip, limit=limit)
    return UnitListResponse(**data)


@router.get("/units/{unit_id}", response_model=dict)
def admin_get_unit(
    unit_id: str,
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """Get a single unit by id. Includes property_title and owner_id/owner_name when set."""
    return uas.get_unit(session, org_id, unit_id)


@router.post("/units", response_model=dict)
@limiter.limit("10/minute")
def admin_create_unit(
    request: Request,
    body: UnitCreate,
    org_id: str = Depends(get_current_organization),
    current_user: User = Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """Create a new unit."""
    return uas.create_unit(session, org_id, str(current_user.id), body)


@router.patch("/units/{unit_id}", response_model=dict)
@limiter.limit("10/minute")
def admin_patch_unit(
    request: Request,
    unit_id: str,
    body: UnitPatch,
    org_id: str = Depends(get_current_organization),
    current_user: User = Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """Update a unit (partial)."""
    return uas.patch_unit(session, org_id, str(current_user.id), unit_id, body)


@router.delete("/units/{unit_id}")
@limiter.limit("10/minute")
def admin_delete_unit(
    request: Request,
    unit_id: str,
    org_id: str = Depends(get_current_organization),
    current_user: User = Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """Delete a unit (caller must ensure no dependent listings/rooms)."""
    return uas.delete_unit(session, org_id, str(current_user.id), unit_id)


@router.get("/units/{unit_id}/rooms", response_model=List[dict])
def admin_list_rooms_for_unit(
    unit_id: str,
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """List rooms belonging to the given unit (listings dropdown + admin)."""
    return uas.list_rooms_for_unit(session, org_id, unit_id)


@router.get("/units/{unit_id}/costs", response_model=List[dict])
def admin_list_unit_costs(
    unit_id: str,
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """List additional monthly costs for a unit (unit_costs table)."""
    return uas.list_unit_costs(session, org_id, unit_id)


@router.post("/units/{unit_id}/costs", response_model=dict)
@limiter.limit("30/minute")
def admin_create_unit_cost(
    request: Request,
    unit_id: str,
    body: UnitCostCreateBody,
    org_id: str = Depends(get_current_organization),
    current_user: User = Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    return uas.create_unit_cost(session, org_id, str(current_user.id), unit_id, body)


@router.patch("/units/{unit_id}/costs/{cost_id}", response_model=dict)
@limiter.limit("30/minute")
def admin_patch_unit_cost(
    request: Request,
    unit_id: str,
    cost_id: str,
    body: UnitCostPatchBody,
    org_id: str = Depends(get_current_organization),
    current_user: User = Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    return uas.patch_unit_cost(session, org_id, str(current_user.id), unit_id, cost_id, body)


@router.delete("/units/{unit_id}/costs/{cost_id}")
@limiter.limit("30/minute")
def admin_delete_unit_cost(
    request: Request,
    unit_id: str,
    cost_id: str,
    org_id: str = Depends(get_current_organization),
    current_user: User = Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    return uas.delete_unit_cost(session, org_id, str(current_user.id), unit_id, cost_id)
