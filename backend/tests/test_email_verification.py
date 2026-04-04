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
from sqlmodel import Session, create_engine

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
