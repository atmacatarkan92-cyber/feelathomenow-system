"""
Canonical audit write path: actor_email + metadata on all create_audit_log rows.
"""

import os
from datetime import datetime, timezone
from typing import Generator

import pytest
from sqlmodel import Session, create_engine, select

from auth.security import hash_password
from db.audit import create_audit_log, merge_audit_metadata
from db.models import AuditLog, Organization, User, UserCredentials, UserRole
from db.rls import apply_pg_organization_context
from tests.db_schema_utils import ensure_test_db_schema_from_models
from tests.org_scoped_cleanup import delete_org_scoped_auth_and_users


@pytest.fixture(scope="module")
def audit_engine():
    test_db_url = os.getenv("TEST_DATABASE_URL")
    if not test_db_url:
        pytest.skip("TEST_DATABASE_URL is not set")
    engine = create_engine(test_db_url, pool_pre_ping=True)
    ensure_test_db_schema_from_models(engine)
    return engine


@pytest.fixture
def audit_session(audit_engine) -> Generator[Session, None, None]:
    with Session(audit_engine) as session:
        yield session


@pytest.fixture
def audit_user(audit_session: Session) -> User:
    delete_org_scoped_auth_and_users(audit_session)
    audit_session.exec(Organization.__table__.delete())

    org = Organization(name="Audit Write Org")
    audit_session.add(org)
    audit_session.flush()
    apply_pg_organization_context(audit_session, str(org.id))

    user = User(
        organization_id=str(org.id),
        email="audit-write@test.example",
        full_name="Audit Writer",
        role=UserRole.admin,
        is_active=True,
        email_verified_at=datetime.now(timezone.utc),
    )
    audit_session.add(user)
    audit_session.flush()
    creds = UserCredentials(
        user_id=str(user.id),
        organization_id=str(org.id),
        password_hash=hash_password("test-password"),
    )
    audit_session.add(creds)
    audit_session.commit()
    audit_session.refresh(user)
    return user


def test_merge_audit_metadata_includes_source():
    m = merge_audit_metadata(request=None, source="admin_api", extra=None)
    assert m is not None
    assert m.get("source") == "admin_api"


def test_create_audit_log_stores_actor_email_and_metadata_without_request(
    audit_session: Session, audit_user: User
):
    apply_pg_organization_context(audit_session, str(audit_user.organization_id))
    create_audit_log(
        audit_session,
        str(audit_user.id),
        "update",
        "unit",
        "unit-audit-1",
        old_values={"x": 1},
        new_values={"x": 2},
        organization_id=str(audit_user.organization_id),
    )
    audit_session.commit()
    row = audit_session.exec(
        select(AuditLog).where(AuditLog.entity_id == "unit-audit-1")
    ).first()
    assert row is not None
    assert row.actor_email == audit_user.email
    meta = row.extra_metadata or {}
    assert meta.get("source") == "admin_api"


def test_create_audit_log_null_actor_skips_email(audit_session: Session, audit_user: User):
    apply_pg_organization_context(audit_session, str(audit_user.organization_id))
    create_audit_log(
        audit_session,
        None,
        "update",
        "unit",
        "unit-no-actor",
        old_values=None,
        new_values={"k": "v"},
        organization_id=str(audit_user.organization_id),
    )
    audit_session.commit()
    row = audit_session.exec(
        select(AuditLog).where(AuditLog.entity_id == "unit-no-actor")
    ).first()
    assert row is not None
    assert row.actor_user_id is None
    assert row.actor_email is None
