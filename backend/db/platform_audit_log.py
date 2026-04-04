"""
Platform-scoped audit rows in ``audit_logs`` (impersonation, future billing, etc.).
Inserts respect RLS: call ``apply_pg_organization_context(session, organization_id)``
before insert when the row's organization_id is not the caller's default GUC.

All writes go through ``db.audit.create_audit_log`` for consistent actor_email + metadata.
"""
from __future__ import annotations

from typing import Any, Optional

from sqlmodel import Session
from starlette.requests import Request

from db.audit import create_audit_log
from db.models import User


def log_audit_event(
    session: Session,
    *,
    actor: User,
    action: str,
    organization_id: Any,
    target_type: Optional[str] = None,
    target_id: Optional[Any] = None,
    metadata: Optional[dict] = None,
    request: Optional[Request] = None,
) -> None:
    """Append one audit_logs row; does not commit. Delegates to canonical create_audit_log."""
    oid = str(organization_id).strip()
    et = (target_type or "").strip() or "platform"
    eid_raw = str(target_id).strip() if target_id is not None else ""
    eid = eid_raw[:64]
    source = "auth_login" if action == "login" else "platform"
    create_audit_log(
        session,
        str(actor.id),
        action,
        et,
        eid,
        old_values=None,
        new_values=None,
        organization_id=oid,
        actor_user=actor,
        metadata=metadata,
        request=request,
        source=source,
    )
