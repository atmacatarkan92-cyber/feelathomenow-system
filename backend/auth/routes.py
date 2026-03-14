from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from db.database import get_session
from db.models import User, UserCredentials
from auth.schemas import LoginRequest, Token, UserMe
from auth.security import verify_password, create_access_token
from auth.dependencies import get_current_user


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(data: LoginRequest, session=Depends(get_session)) -> Token:
    statement = select(User, UserCredentials).join(
        UserCredentials, User.id == UserCredentials.user_id
    ).where(
        User.email == data.email,
        User.is_active == True,  # noqa: E712
    )
    result = session.exec(statement).first()

    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    user, credentials = result

    if not verify_password(data.password, credentials.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    user.last_login_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()

    token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role.value,
        }
    )

    return Token(access_token=token)


@router.get("/me", response_model=UserMe)
def read_me(current_user: User = Depends(get_current_user)) -> UserMe:
    return UserMe(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value,
        is_active=current_user.is_active,
        last_login_at=current_user.last_login_at,
    )

