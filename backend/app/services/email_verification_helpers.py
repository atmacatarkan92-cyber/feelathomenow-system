"""
Email verification tokens for org onboarding (and future flows).

Creates a hashed token row after the org+admin transaction has committed, then sends email.
Email send failures are logged only — org/admin creation remains successful.
"""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func
from sqlmodel import Session, select

from auth.security import hash_password_reset_token
from db.models import EmailVerificationToken, User
from db.rls import apply_pg_auth_unscoped_user_lookup, apply_pg_organization_context
from email_service import EmailServiceError, send_email_verification_email

logger = logging.getLogger(__name__)


def safe_log(logger_fn, *args, **kwargs) -> None:
    """Never raise from logging (observability must not break request flow)."""
    try:
        logger_fn(*args, **kwargs)
    except Exception:
        pass


def _ttl_minutes() -> int:
    try:
        v = int(os.environ.get("EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES", "1440"))
        return max(1, v)
    except ValueError:
        return 1440


def try_create_and_send_email_verification_for_org_admin(
    session: Session,
    *,
    organization_id: str,
    admin_email: str,
    request_id: str | None = None,
) -> None:
    """
    Call only after org + initial admin have committed successfully.
    Inserts a verification token and commits, then sends the verification email.
    """
    email_norm = admin_email.strip().lower()
    apply_pg_organization_context(session, organization_id)
    user = session.exec(
        select(User).where(
            User.organization_id == organization_id,
            func.lower(User.email) == email_norm,
        )
    ).first()
    if user is None:
        logger.warning(
            "email_verification_skip_user_missing org=%s email=%s",
            organization_id,
            email_norm,
        )
        return
    if user.email_verified_at is not None:
        return

    raw = secrets.token_urlsafe(48)
    token_hash = hash_password_reset_token(raw)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=_ttl_minutes())
    session.add(
        EmailVerificationToken(
            user_id=str(user.id),
            token_hash=token_hash,
            expires_at=expires_at,
            used_at=None,
        )
    )
    session.commit()

    safe_log(
        logger.info,
        "event=email_verification_token_created user_id=%s organization_id=%s token_expires_at=%s request_id=%s",
        str(user.id),
        organization_id,
        expires_at.isoformat(),
        request_id or "-",
    )

    frontend_url = (os.environ.get("FRONTEND_URL") or "").strip() or "http://localhost:3000"
    base = frontend_url.rstrip("/")
    link = f"{base}/verify-email?token={raw}"
    try:
        send_email_verification_email(user.email, link)
    except EmailServiceError as e:
        safe_log(
            logger.warning,
            "email_verification_send_failed user_id=%s: %s",
            user.id,
            e,
        )


def process_resend_verification_email(
    session: Session,
    *,
    email_norm: str,
    request_id: str | None = None,
) -> None:
    """
    For each active user with this email (case-insensitive) and email_verified_at IS NULL:
    remove pending verification tokens, insert a single new token, commit, then send email(s).

    Uses unscoped user lookup like login/forgot-password. Email send failures are logged only.
    """
    apply_pg_auth_unscoped_user_lookup(session)
    rows = session.exec(
        select(User).where(
            func.lower(User.email) == email_norm,
            User.is_active == True,  # noqa: E712
        )
    ).all()
    pending = [
        (str(u.id), str(u.organization_id), u.email, u.email_verified_at) for u in rows
    ]
    session.info.pop("rls_auth_unscoped", None)
    session.commit()

    tokens_to_send: list[tuple[str, str, str, str]] = []
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=_ttl_minutes())
    frontend_url = (os.environ.get("FRONTEND_URL") or "").strip() or "http://localhost:3000"
    base = frontend_url.rstrip("/")

    for user_id, org_id, user_email, verified_at in pending:
        if verified_at is not None:
            continue
        apply_pg_organization_context(session, org_id)
        del_result = session.execute(
            delete(EmailVerificationToken).where(
                EmailVerificationToken.user_id == user_id,
                EmailVerificationToken.used_at.is_(None),
            )
        )
        deleted_count = int(getattr(del_result, "rowcount", None) or 0)
        if deleted_count > 0:
            safe_log(
                logger.info,
                "event=email_verification_tokens_invalidated user_id=%s organization_id=%s deleted_count=%s request_id=%s",
                user_id,
                org_id,
                deleted_count,
                request_id or "-",
            )
        raw = secrets.token_urlsafe(48)
        token_hash = hash_password_reset_token(raw)
        session.add(
            EmailVerificationToken(
                user_id=user_id,
                token_hash=token_hash,
                expires_at=expires_at,
                used_at=None,
            )
        )
        session.flush()
        safe_log(
            logger.info,
            "event=email_verification_token_created user_id=%s organization_id=%s token_expires_at=%s request_id=%s",
            user_id,
            org_id,
            expires_at.isoformat(),
            request_id or "-",
        )
        tokens_to_send.append((user_email, raw, user_id, org_id))

    session.commit()

    for user_email, raw, user_id, org_id in tokens_to_send:
        link = f"{base}/verify-email?token={raw}"
        try:
            send_email_verification_email(user_email, link)
            safe_log(
                logger.info,
                "event=email_verification_resend_sent user_id=%s organization_id=%s",
                user_id,
                org_id,
            )
        except EmailServiceError as e:
            safe_log(
                logger.warning,
                "event=email_verification_resend_failed error_type=%s user_id=%s",
                type(e).__name__,
                user_id,
            )
