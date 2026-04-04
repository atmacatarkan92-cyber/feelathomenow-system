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

router = APIRouter(prefix="/api/admin", tags=["admin-users"])

_CREATABLE_ROLES = frozenset({"admin", "landlord", "tenant"})


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
