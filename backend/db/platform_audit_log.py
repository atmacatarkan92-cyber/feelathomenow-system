"""
Platform-scoped audit rows in ``audit_logs`` (impersonation, future billing, etc.).
Inserts respect RLS: call ``apply_pg_organization_context(session, organization_id)``
before insert when the row's organization_id is not the caller's default GUC.
"""
from __future__ import annotations

from typing import Any, Optional

from sqlmodel import Session

from db.models import AuditLog, User


def log_audit_event(
    session: Session,
    *,
    actor: User,
    action: str,
    organization_id: Any,
    target_type: Optional[str] = None,
    target_id: Optional[Any] = None,
    metadata: Optional[dict] = None,
) -> None:
    """Append one audit_logs row; does not commit."""
    oid = str(organization_id).strip()
    et = (target_type or "").strip() or "platform"
    eid_raw = str(target_id).strip() if target_id is not None else ""
    eid = eid_raw[:64]
    entry = AuditLog(
        organization_id=oid,
        actor_user_id=str(actor.id),
        actor_email=getattr(actor, "email", None),
        action=action[:128],
        entity_type=et,
        entity_id=eid,
        extra_metadata=metadata,
        old_values=None,
        new_values=None,
    )
    session.add(entry)
