"""
Admin user provisioning: create users in the caller's organization only.
POST /api/admin/users — requires role admin (not manager).
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.core.rate_limit import limiter
from auth.dependencies import get_db_session, require_roles
from auth.security import hash_password, password_meets_policy_for_new_account
from db.models import User, UserCredentials, UserRole
from db.rls import apply_pg_organization_context

router = APIRouter(prefix="/api/admin", tags=["admin-users"])

_CREATABLE_ROLES = frozenset({"admin", "landlord", "tenant"})


class AdminUserOut(BaseModel):
    """Org-scoped user row for admin list/detail (read-only)."""

    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    email_verified_at: datetime | None = None


def _user_to_admin_out(user: User) -> AdminUserOut:
    role_out = getattr(user.role, "value", user.role)
    return AdminUserOut(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name or "",
        role=str(role_out),
        is_active=bool(user.is_active),
        email_verified_at=user.email_verified_at,
    )


@router.get("/users", response_model=list[AdminUserOut])
def admin_list_users(
    current_user: User = Depends(require_roles("admin")),
    session=Depends(get_db_session),
):
    """List users in the caller's organization (admin only)."""
    org_id = str(current_user.organization_id)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )
    apply_pg_organization_context(session, org_id)
    rows = session.exec(select(User).where(User.organization_id == org_id).order_by(User.email)).all()
    return [_user_to_admin_out(u) for u in rows]


@router.get("/users/{user_id}", response_model=AdminUserOut)
def admin_get_user(
    user_id: str,
    current_user: User = Depends(require_roles("admin")),
    session=Depends(get_db_session),
):
    """Return one user in the caller's organization (admin only)."""
    org_id = str(current_user.organization_id)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )
    apply_pg_organization_context(session, org_id)
    u = session.get(User, user_id)
    if u is None or str(u.organization_id) != org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )
    return _user_to_admin_out(u)


class AdminCreateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=32)
    name: str | None = Field(default=None, max_length=200)


class AdminCreateUserResponse(BaseModel):
    id: str
    email: str
    role: str
    organization_id: str
    created: bool = True


def _resolve_full_name(body: AdminCreateUserRequest) -> str:
    if body.name and body.name.strip():
        return body.name.strip()
    return str(body.email).split("@")[0] or "User"


def _role_from_request(role_str: str) -> UserRole:
    role_norm = role_str.strip().lower()
    if role_norm not in _CREATABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role",
        )
    try:
        return UserRole(role_norm)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role",
        )


@router.post("/users", response_model=AdminCreateUserResponse)
@limiter.limit("20/minute")
def admin_create_user(
    request: Request,
    body: AdminCreateUserRequest,
    current_user: User = Depends(require_roles("admin")),
    session=Depends(get_db_session),
):
    """
    Create a user in the same organization as the authenticated admin.
    Does not accept organization_id from the client.
    """
    org_id = str(current_user.organization_id)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )

    target_role = _role_from_request(body.role)

    if not password_meets_policy_for_new_account(body.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password does not meet requirements",
        )

    email_norm = str(body.email).strip().lower()
    try:
        existing = session.exec(
            select(User).where(
                User.organization_id == org_id,
                func.lower(User.email) == email_norm,
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use",
            )

        verified_now = datetime.now(timezone.utc)
        user = User(
            organization_id=org_id,
            email=str(body.email).strip(),
            full_name=_resolve_full_name(body),
            role=target_role,
            is_active=True,
            email_verified_at=verified_now,
            updated_at=verified_now,
        )
        session.add(user)
        session.flush()

        creds = UserCredentials(
            user_id=str(user.id),
            organization_id=org_id,
            password_hash=hash_password(body.password),
        )
        session.add(creds)
        session.commit()
        session.refresh(user)

        role_out = getattr(user.role, "value", user.role)
        return AdminCreateUserResponse(
            id=str(user.id),
            email=user.email,
            role=str(role_out),
            organization_id=str(user.organization_id),
            created=True,
        )
    except HTTPException:
        session.rollback()
        raise
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already in use",
        )
