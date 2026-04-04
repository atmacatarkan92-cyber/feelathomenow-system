"""
Email verification tokens + POST /auth/verify-email (requires TEST_DATABASE_URL).
"""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, select

from auth.dependencies import get_db_session
from auth.security import hash_password, hash_password_reset_token
from db.models import (
    EmailVerificationToken,
    Organization,
    User,
    UserCredentials,
    UserRole,
)
from db.rls import apply_pg_organization_context
from tests.db_schema_utils import ensure_test_db_schema_from_models
from tests.org_scoped_cleanup import delete_org_scoped_auth_and_users


@pytest.fixture(scope="session")
def ev_test_engine():
    test_db_url = os.getenv("TEST_DATABASE_URL")
    if not test_db_url:
        pytest.skip("TEST_DATABASE_URL is not set; skipping email verification DB tests.")
    engine = create_engine(test_db_url, pool_pre_ping=True)
    ensure_test_db_schema_from_models(engine)
    return engine


@pytest.fixture
def ev_db_session(ev_test_engine) -> Generator[Session, None, None]:
    with Session(ev_test_engine) as session:
        yield session


@pytest.fixture
def override_ev_db(ev_db_session: Session, app) -> Generator[None, None, None]:
    def _override() -> Generator[Session, None, None]:
        try:
            yield ev_db_session
        finally:
            pass

    app.dependency_overrides[get_db_session] = _override
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
def cleanup_ev(ev_db_session: Session):
    delete_org_scoped_auth_and_users(ev_db_session)
    ev_db_session.exec(Organization.__table__.delete())
    ev_db_session.commit()


@pytest.fixture
def org_user_unverified(ev_db_session: Session, cleanup_ev):
    org = Organization(name="EV Org")
    ev_db_session.add(org)
    ev_db_session.flush()
    apply_pg_organization_context(ev_db_session, str(org.id))
    user = User(
        organization_id=str(org.id),
        email="ev-user@test.example",
        full_name="EV User",
        role=UserRole.admin,
        is_active=True,
        email_verified_at=None,
    )
    ev_db_session.add(user)
    ev_db_session.flush()
    ev_db_session.add(
        UserCredentials(
            user_id=str(user.id),
            organization_id=str(org.id),
            password_hash=hash_password("ValidPwd1ab"),
        )
    )
    ev_db_session.commit()
    ev_db_session.refresh(user)
    return {"org_id": str(org.id), "user_id": str(user.id), "email": user.email}


@pytest.fixture
def org_user_verified(ev_db_session: Session, cleanup_ev):
    org = Organization(name="EV Org Verified")
    ev_db_session.add(org)
    ev_db_session.flush()
    apply_pg_organization_context(ev_db_session, str(org.id))
    user = User(
        organization_id=str(org.id),
        email="ev-verified@test.example",
        full_name="EV Verified",
        role=UserRole.admin,
        is_active=True,
        email_verified_at=datetime.now(timezone.utc),
    )
    ev_db_session.add(user)
    ev_db_session.flush()
    ev_db_session.add(
        UserCredentials(
            user_id=str(user.id),
            organization_id=str(org.id),
            password_hash=hash_password("ValidPwd1ab"),
        )
    )
    ev_db_session.commit()
    ev_db_session.refresh(user)
    return {"org_id": str(org.id), "user_id": str(user.id), "email": user.email}


class TestVerifyEmail:
    def test_verify_succeeds_sets_email_verified_at(
        self,
        client: TestClient,
        override_ev_db,
        org_user_unverified: dict,
        ev_db_session: Session,
    ):
        raw = secrets.token_urlsafe(48)
        th = hash_password_reset_token(raw)
        now = datetime.now(timezone.utc)
        ev_db_session.add(
            EmailVerificationToken(
                user_id=org_user_unverified["user_id"],
                token_hash=th,
                expires_at=now + timedelta(hours=1),
                used_at=None,
            )
        )
        ev_db_session.commit()

        r = client.post("/auth/verify-email", json={"token": raw})
        assert r.status_code == 200, r.text
        assert r.json()["detail"] == "Email verified"

        ev_db_session.expire_all()
        u = ev_db_session.get(User, org_user_unverified["user_id"])
        assert u is not None
        assert u.email_verified_at is not None

    def test_verify_expired_token_fails(
        self,
        client: TestClient,
        override_ev_db,
        org_user_unverified: dict,
        ev_db_session: Session,
    ):
        raw = secrets.token_urlsafe(48)
        th = hash_password_reset_token(raw)
        now = datetime.now(timezone.utc)
        ev_db_session.add(
            EmailVerificationToken(
                user_id=org_user_unverified["user_id"],
                token_hash=th,
                expires_at=now - timedelta(minutes=1),
                used_at=None,
            )
        )
        ev_db_session.commit()

        r = client.post("/auth/verify-email", json={"token": raw})
        assert r.status_code == 400
        assert "Invalid" in r.json()["detail"]

    def test_verify_twice_second_is_idempotent(
        self,
        client: TestClient,
        override_ev_db,
        org_user_unverified: dict,
        ev_db_session: Session,
    ):
        raw = secrets.token_urlsafe(48)
        th = hash_password_reset_token(raw)
        now = datetime.now(timezone.utc)
        ev_db_session.add(
            EmailVerificationToken(
                user_id=org_user_unverified["user_id"],
                token_hash=th,
                expires_at=now + timedelta(hours=1),
                used_at=None,
            )
        )
        ev_db_session.commit()

        r1 = client.post("/auth/verify-email", json={"token": raw})
        assert r1.status_code == 200
        assert r1.json()["detail"] == "Email verified"

        r2 = client.post("/auth/verify-email", json={"token": raw})
        assert r2.status_code == 200
        assert r2.json()["detail"] == "Email already verified"

    def test_verify_invalid_token_fails(self, client: TestClient, override_ev_db):
        r = client.post("/auth/verify-email", json={"token": secrets.token_urlsafe(48)})
        assert r.status_code == 400

    def test_verify_used_token_without_verified_user_fails(
        self,
        client: TestClient,
        override_ev_db,
        org_user_unverified: dict,
        ev_db_session: Session,
    ):
        """Corrupt state: used_at set but user not verified — reject."""
        raw = secrets.token_urlsafe(48)
        th = hash_password_reset_token(raw)
        now = datetime.now(timezone.utc)
        ev_db_session.add(
            EmailVerificationToken(
                user_id=org_user_unverified["user_id"],
                token_hash=th,
                expires_at=now + timedelta(hours=1),
                used_at=now,
            )
        )
        ev_db_session.commit()

        r = client.post("/auth/verify-email", json={"token": raw})
        assert r.status_code == 400

    def test_login_blocked_when_email_unverified(
        self,
        client: TestClient,
        override_ev_db,
        org_user_unverified: dict,
    ):
        r = client.post(
            "/auth/login",
            json={
                "email": org_user_unverified["email"],
                "password": "ValidPwd1ab",
            },
        )
        assert r.status_code == 403
        assert r.json()["detail"] == "email_not_verified"

    def test_login_succeeds_after_verification(
        self,
        client: TestClient,
        override_ev_db,
        org_user_unverified: dict,
        ev_db_session: Session,
    ):
        raw = secrets.token_urlsafe(48)
        th = hash_password_reset_token(raw)
        now = datetime.now(timezone.utc)
        ev_db_session.add(
            EmailVerificationToken(
                user_id=org_user_unverified["user_id"],
                token_hash=th,
                expires_at=now + timedelta(hours=1),
                used_at=None,
            )
        )
        ev_db_session.commit()

        assert client.post("/auth/verify-email", json={"token": raw}).status_code == 200

        r = client.post(
            "/auth/login",
            json={
                "email": org_user_unverified["email"],
                "password": "ValidPwd1ab",
            },
        )
        assert r.status_code == 200
        assert "access_token" in r.json()


class TestResendVerification:
    GENERIC_DETAIL = "If the account exists, a verification email has been sent."

    def test_resend_unverified_creates_token(
        self,
        client: TestClient,
        override_ev_db,
        org_user_unverified: dict,
        ev_db_session: Session,
        monkeypatch,
    ):
        sent = {"n": 0}

        def _fake_send(_email: str, _link: str) -> bool:
            sent["n"] += 1
            return True

        monkeypatch.setattr(
            "app.services.email_verification_helpers.send_email_verification_email",
            _fake_send,
        )
        uid = org_user_unverified["user_id"]
        r = client.post(
            "/auth/resend-verification",
            json={"email": org_user_unverified["email"]},
        )
        assert r.status_code == 200
        assert r.json()["detail"] == self.GENERIC_DETAIL
        assert sent["n"] == 1
        rows = ev_db_session.exec(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == uid)
        ).all()
        assert len(rows) == 1
        assert rows[0].used_at is None

    def test_resend_replaces_old_pending_token(
        self,
        client: TestClient,
        override_ev_db,
        org_user_unverified: dict,
        ev_db_session: Session,
        monkeypatch,
    ):
        monkeypatch.setattr(
            "app.services.email_verification_helpers.send_email_verification_email",
            lambda *_a, **_k: True,
        )
        uid = org_user_unverified["user_id"]
        oid = org_user_unverified["org_id"]
        now = datetime.now(timezone.utc)
        old_hash = hash_password_reset_token("old-raw-token-placeholder")
        apply_pg_organization_context(ev_db_session, oid)
        ev_db_session.add(
            EmailVerificationToken(
                user_id=uid,
                token_hash=old_hash,
                expires_at=now + timedelta(hours=1),
                used_at=None,
            )
        )
        ev_db_session.commit()

        r = client.post(
            "/auth/resend-verification",
            json={"email": org_user_unverified["email"]},
        )
        assert r.status_code == 200
        rows = ev_db_session.exec(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == uid)
        ).all()
        assert len(rows) == 1
        assert rows[0].token_hash != old_hash

    def test_resend_verified_user_does_not_add_token(
        self,
        client: TestClient,
        override_ev_db,
        org_user_verified: dict,
        ev_db_session: Session,
        monkeypatch,
    ):
        monkeypatch.setattr(
            "app.services.email_verification_helpers.send_email_verification_email",
            lambda *_a, **_k: True,
        )
        uid = org_user_verified["user_id"]
        r = client.post(
            "/auth/resend-verification",
            json={"email": org_user_verified["email"]},
        )
        assert r.status_code == 200
        rows = ev_db_session.exec(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == uid)
        ).all()
        assert len(rows) == 0

    def test_resend_unknown_email_returns_generic_success(self, client: TestClient, override_ev_db):
        r = client.post(
            "/auth/resend-verification",
            json={"email": "nobody-here-xyz@test.example"},
        )
        assert r.status_code == 200
        assert r.json()["detail"] == self.GENERIC_DETAIL

    def test_resend_rate_limit_enforced(self, client: TestClient, app, override_ev_db):
        app.state.limiter.enabled = True
        try:
            body = {"email": "rate-limit@test.example"}
            for _ in range(5):
                assert client.post("/auth/resend-verification", json=body).status_code == 200
            assert client.post("/auth/resend-verification", json=body).status_code == 429
        finally:
            app.state.limiter.enabled = False
