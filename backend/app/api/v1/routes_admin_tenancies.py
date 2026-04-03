"""
Admin tenancies: CRUD + list by room.
Protected by require_roles("admin", "manager").
Validates tenant/room/unit exist, room belongs to unit, no overlapping tenancies.

Tenancy model: one tenancies row is the occupancy contract for one room slot. TenancyParticipant
rows link tenant persons to that contract with roles (primary_tenant, co_tenant, solidarhafter).
Phase 1 keeps tenancies.tenant_id equal to the primary participant for invoices and legacy code.
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field, field_validator, model_validator

from auth.dependencies import get_current_organization, get_db_session, require_roles
from db.models import TenancyStatus, User
from app.core.rate_limit import limiter
from app.services import tenancy_admin_service as tas

# Backward compatibility for tests importing private helpers from this module
_tenancy_to_dict = tas.tenancy_to_dict
_batch_attach_monthly_revenue_equivalent = tas.batch_attach_monthly_revenue_equivalent


router = APIRouter(prefix="/api/admin", tags=["admin-tenancies"])

ALLOWED_TENANT_DEPOSIT_TYPES = frozenset({"bank", "insurance", "cash", "none"})
ALLOWED_TENANT_DEPOSIT_PROVIDERS = frozenset(
    {"swisscaution", "smartcaution", "firstcaution", "gocaution", "other"}
)
ALLOWED_TENANCY_REVENUE_FREQUENCIES = frozenset({"monthly", "yearly", "one_time"})
ALLOWED_TERMINATED_BY = frozenset({"tenant", "landlord", "other"})
ALLOWED_TENANCY_PARTICIPANT_ROLES = frozenset({"primary_tenant", "co_tenant", "solidarhafter"})


class TenancyRevenueCreateBody(BaseModel):
    type: str
    amount_chf: float
    frequency: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("type", mode="before")
    @classmethod
    def _normalize_type(cls, v):
        if v is None:
            raise ValueError("type is required")
        s = str(v).strip()
        if not s:
            raise ValueError("type must not be empty")
        return s

    @field_validator("frequency", mode="before")
    @classmethod
    def _normalize_frequency(cls, v):
        if v is None or v == "":
            return None
        s = str(v).strip().lower()
        if s not in ALLOWED_TENANCY_REVENUE_FREQUENCIES:
            raise ValueError("frequency must be one of: monthly, yearly, one_time")
        return s

    @field_validator("amount_chf")
    @classmethod
    def _amount_non_zero(cls, v):
        if v is None:
            raise ValueError("amount_chf is required")
        n = float(v)
        if n == 0:
            raise ValueError("amount_chf must not be 0")
        return n

    @model_validator(mode="after")
    def _validate_dates(self):
        if self.start_date is not None and self.end_date is not None:
            if self.end_date < self.start_date:
                raise ValueError("end_date must be on/after start_date")
        return self


class TenancyRevenuePatchBody(BaseModel):
    type: Optional[str] = None
    amount_chf: Optional[float] = None
    frequency: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "TenancyRevenuePatchBody":
        if (
            self.type is None
            and self.amount_chf is None
            and self.frequency is None
            and self.start_date is None
            and self.end_date is None
            and self.notes is None
        ):
            raise ValueError("At least one field is required")
        return self

    @field_validator("type", mode="before")
    @classmethod
    def _normalize_type_patch(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            raise ValueError("type must not be empty")
        return s

    @field_validator("frequency", mode="before")
    @classmethod
    def _normalize_frequency_patch(cls, v):
        if v is None:
            return None
        s = str(v).strip().lower()
        if not s:
            return None
        if s not in ALLOWED_TENANCY_REVENUE_FREQUENCIES:
            raise ValueError("frequency must be one of: monthly, yearly, one_time")
        return s

    @field_validator("amount_chf")
    @classmethod
    def _amount_non_zero_if_set(cls, v):
        if v is None:
            return None
        n = float(v)
        if n == 0:
            raise ValueError("amount_chf must not be 0")
        return n

    @model_validator(mode="after")
    def _validate_dates_patch(self):
        if self.start_date is not None and self.end_date is not None:
            if self.end_date < self.start_date:
                raise ValueError("end_date must be on/after start_date")
        return self


class TenancyParticipantInput(BaseModel):
    """One person on a tenancy with a role (primary_tenant, co_tenant, solidarhafter)."""

    tenant_id: str
    role: str

    @field_validator("tenant_id", mode="before")
    @classmethod
    def _strip_tenant_id(cls, v):
        s = str(v or "").strip()
        if not s:
            raise ValueError("tenant_id must not be empty")
        return s

    @field_validator("role", mode="before")
    @classmethod
    def _normalize_role(cls, v):
        s = str(v or "").strip().lower()
        if s not in ALLOWED_TENANCY_PARTICIPANT_ROLES:
            raise ValueError(
                "role must be one of: primary_tenant, co_tenant, solidarhafter"
            )
        return s


class TenancyCreate(BaseModel):
    tenant_id: str
    room_id: str
    unit_id: str
    move_in_date: date
    move_out_date: Optional[date] = None
    notice_given_at: Optional[date] = None
    termination_effective_date: Optional[date] = None
    actual_move_out_date: Optional[date] = None
    terminated_by: Optional[str] = None
    monthly_rent: float = Field(default=0, ge=0)
    deposit_amount: Optional[float] = Field(default=None, ge=0)
    tenant_deposit_type: Optional[str] = None
    tenant_deposit_amount: Optional[float] = Field(default=None, ge=0)
    tenant_deposit_annual_premium: Optional[float] = Field(default=None, ge=0)
    tenant_deposit_provider: Optional[str] = None
    status: TenancyStatus = TenancyStatus.active
    participants: Optional[List[TenancyParticipantInput]] = Field(default=None)

    @field_validator("tenant_deposit_type", mode="before")
    @classmethod
    def _normalize_tenant_deposit_type_create(cls, v):
        if v is None or v == "":
            return None
        s = str(v).strip().lower()
        if s not in ALLOWED_TENANT_DEPOSIT_TYPES:
            raise ValueError(
                "tenant_deposit_type must be one of: bank, insurance, cash, none"
            )
        return s

    @field_validator("tenant_deposit_provider", mode="before")
    @classmethod
    def _normalize_tenant_deposit_provider_create(cls, v):
        if v is None or v == "":
            return None
        s = str(v).strip().lower()
        if s not in ALLOWED_TENANT_DEPOSIT_PROVIDERS:
            raise ValueError(
                "tenant_deposit_provider must be one of: "
                "swisscaution, smartcaution, firstcaution, gocaution, other"
            )
        return s

    @model_validator(mode="after")
    def _validate_dates(self):
        if not self.tenant_id or not self.tenant_id.strip():
            raise ValueError("tenant_id must not be empty")
        if not self.room_id or not self.room_id.strip():
            raise ValueError("room_id must not be empty")
        if not self.unit_id or not self.unit_id.strip():
            raise ValueError("unit_id must not be empty")
        if self.move_out_date is not None and self.move_out_date < self.move_in_date:
            raise ValueError("move_out_date must be on/after move_in_date")
        if (
            self.termination_effective_date is not None
            and self.termination_effective_date < self.move_in_date
        ):
            raise ValueError("termination_effective_date must be on/after move_in_date")
        if self.actual_move_out_date is not None and self.actual_move_out_date < self.move_in_date:
            raise ValueError("actual_move_out_date must be on/after move_in_date")
        return self

    @field_validator("terminated_by", mode="before")
    @classmethod
    def _normalize_terminated_by_create(cls, v):
        if v is None or v == "":
            return None
        s = str(v).strip().lower()
        if s not in ALLOWED_TERMINATED_BY:
            raise ValueError("terminated_by must be one of: tenant, landlord, other")
        return s

    @model_validator(mode="after")
    def _clear_tenant_deposit_provider_if_not_insurance_create(self):
        t = self.tenant_deposit_type
        if t is None or str(t).lower() != "insurance":
            self.tenant_deposit_provider = None
        return self

    @model_validator(mode="after")
    def _validate_participants_create(self):
        if self.participants is None:
            return self
        if len(self.participants) == 0:
            raise ValueError("participants, if provided, must not be empty")
        primaries = [p for p in self.participants if p.role == "primary_tenant"]
        if len(primaries) != 1:
            raise ValueError("participants must include exactly one primary_tenant")
        if primaries[0].tenant_id != str(self.tenant_id).strip():
            raise ValueError("primary_tenant must match tenant_id")
        tids = [p.tenant_id for p in self.participants]
        if len(tids) != len(set(tids)):
            raise ValueError("duplicate tenant_id in participants")
        return self


class TenancyPatch(BaseModel):
    move_in_date: Optional[date] = None
    move_out_date: Optional[date] = None
    notice_given_at: Optional[date] = None
    termination_effective_date: Optional[date] = None
    actual_move_out_date: Optional[date] = None
    terminated_by: Optional[str] = None
    monthly_rent: Optional[float] = Field(default=None, ge=0)
    deposit_amount: Optional[float] = Field(default=None, ge=0)
    tenant_deposit_type: Optional[str] = None
    tenant_deposit_amount: Optional[float] = Field(default=None, ge=0)
    tenant_deposit_annual_premium: Optional[float] = Field(default=None, ge=0)
    tenant_deposit_provider: Optional[str] = None
    status: Optional[TenancyStatus] = None
    participants: Optional[List[TenancyParticipantInput]] = None

    @field_validator("tenant_deposit_type", mode="before")
    @classmethod
    def _normalize_tenant_deposit_type_patch(cls, v):
        if v is None or v == "":
            return None
        s = str(v).strip().lower()
        if s not in ALLOWED_TENANT_DEPOSIT_TYPES:
            raise ValueError(
                "tenant_deposit_type must be one of: bank, insurance, cash, none"
            )
        return s

    @field_validator("tenant_deposit_provider", mode="before")
    @classmethod
    def _normalize_tenant_deposit_provider_patch(cls, v):
        if v is None or v == "":
            return None
        s = str(v).strip().lower()
        if s not in ALLOWED_TENANT_DEPOSIT_PROVIDERS:
            raise ValueError(
                "tenant_deposit_provider must be one of: "
                "swisscaution, smartcaution, firstcaution, gocaution, other"
            )
        return s

    @field_validator("terminated_by", mode="before")
    @classmethod
    def _normalize_terminated_by_patch(cls, v):
        if v is None or v == "":
            return None
        s = str(v).strip().lower()
        if s not in ALLOWED_TERMINATED_BY:
            raise ValueError("terminated_by must be one of: tenant, landlord, other")
        return s

    @model_validator(mode="after")
    def _validate_dates_if_both_present(self):
        if self.move_in_date is not None and self.move_out_date is not None:
            if self.move_out_date < self.move_in_date:
                raise ValueError("move_out_date must be on/after move_in_date")
        if self.move_in_date is not None and self.termination_effective_date is not None:
            if self.termination_effective_date < self.move_in_date:
                raise ValueError("termination_effective_date must be on/after move_in_date")
        if self.move_in_date is not None and self.actual_move_out_date is not None:
            if self.actual_move_out_date < self.move_in_date:
                raise ValueError("actual_move_out_date must be on/after move_in_date")
        return self

    @model_validator(mode="after")
    def _clear_tenant_deposit_provider_if_not_insurance_patch(self):
        if self.tenant_deposit_type is None:
            return self
        if str(self.tenant_deposit_type).lower() != "insurance":
            self.tenant_deposit_provider = None
        return self

    @model_validator(mode="after")
    def _validate_participants_patch(self):
        if self.participants is None:
            return self
        if len(self.participants) == 0:
            raise ValueError("participants must not be empty when provided")
        primaries = [p for p in self.participants if p.role == "primary_tenant"]
        if len(primaries) != 1:
            raise ValueError("participants must include exactly one primary_tenant")
        tids = [p.tenant_id for p in self.participants]
        if len(tids) != len(set(tids)):
            raise ValueError("duplicate tenant_id in participants")
        return self


class TenancyListResponse(BaseModel):
    items: List[dict]
    total: int
    skip: int
    limit: int


@router.get("/tenancies", response_model=TenancyListResponse)
def admin_list_tenancies(
    room_id: Optional[str] = None,
    unit_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    include_participant: bool = Query(
        False,
        description="With tenant_id: include tenancies where tenant appears in tenancy_participants",
    ),
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """List tenancies, optionally filtered by room_id, unit_id, tenant_id, status."""
    data = tas.list_tenancies(
        session,
        org_id,
        room_id=room_id,
        unit_id=unit_id,
        tenant_id=tenant_id,
        include_participant=include_participant,
        status=status,
        skip=skip,
        limit=limit,
    )
    return TenancyListResponse(**data)


@router.get("/rooms/{room_id}/tenancies", response_model=List[dict])
def admin_list_tenancies_for_room(
    room_id: str,
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """List tenancies for a room."""
    return tas.list_tenancies_for_room(session, org_id, room_id)


@router.post("/tenancies", response_model=dict)
@limiter.limit("10/minute")
def admin_create_tenancy(
    request: Request,
    body: TenancyCreate,
    org_id: str = Depends(get_current_organization),
    current_user: User = Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """Create a tenancy. Validates tenant/room/unit and prevents overlapping tenancies."""
    return tas.create_tenancy(session, org_id, str(current_user.id), body)


@router.patch("/tenancies/{tenancy_id}", response_model=dict)
@limiter.limit("10/minute")
def admin_patch_tenancy(
    request: Request,
    tenancy_id: str,
    body: TenancyPatch,
    org_id: str = Depends(get_current_organization),
    current_user: User = Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """Update a tenancy (partial). Checks overlap when dates change."""
    return tas.patch_tenancy(session, org_id, str(current_user.id), tenancy_id, body)


@router.delete("/tenancies/{tenancy_id}")
@limiter.limit("10/minute")
def admin_delete_tenancy(
    request: Request,
    tenancy_id: str,
    org_id: str = Depends(get_current_organization),
    current_user: User = Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    """Delete a tenancy."""
    return tas.delete_tenancy(session, org_id, str(current_user.id), tenancy_id)


@router.get("/tenancies/{tenancy_id}/revenue", response_model=List[dict])
def admin_list_tenancy_revenue(
    tenancy_id: str,
    org_id: str = Depends(get_current_organization),
    _=Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    return tas.list_tenancy_revenue(session, org_id, tenancy_id)


@router.post("/tenancies/{tenancy_id}/revenue", response_model=dict)
@limiter.limit("30/minute")
def admin_create_tenancy_revenue(
    request: Request,
    tenancy_id: str,
    body: TenancyRevenueCreateBody,
    org_id: str = Depends(get_current_organization),
    current_user: User = Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    return tas.create_tenancy_revenue(session, org_id, str(current_user.id), tenancy_id, body)


@router.patch("/tenancy-revenue/{revenue_id}", response_model=dict)
@limiter.limit("30/minute")
def admin_patch_tenancy_revenue(
    request: Request,
    revenue_id: str,
    body: TenancyRevenuePatchBody,
    org_id: str = Depends(get_current_organization),
    current_user: User = Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    return tas.patch_tenancy_revenue(session, org_id, str(current_user.id), revenue_id, body)


@router.delete("/tenancy-revenue/{revenue_id}")
@limiter.limit("30/minute")
def admin_delete_tenancy_revenue(
    request: Request,
    revenue_id: str,
    org_id: str = Depends(get_current_organization),
    current_user: User = Depends(require_roles("admin", "manager")),
    session=Depends(get_db_session),
):
    return tas.delete_tenancy_revenue(session, org_id, str(current_user.id), revenue_id)
