"""
V1 audit logging: single canonical helper for all audit_rows.

Call after successful writes within the same transaction so the audit commits with the write.
Parent-stream convention (admin timelines): log child changes under the same
entity_type/entity_id as the detail page (unit / tenant / owner) with namespaced
payloads (e.g. tenancy, tenancy_revenue, room, unit_cost).
"""
from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, Optional

from sqlmodel import Session
from starlette.requests import Request

from app.core.client_ip import get_client_ip
from db.models import AuditLog, User


def _serialize_value(v: Any) -> Any:
    """Convert a single value to a JSON-serializable form."""
    if v is None:
        return None
    if isinstance(v, (str, int, float, bool)):
        return v
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if hasattr(v, "value"):  # Enum
        return v.value
    return str(v)


def model_snapshot(obj: Any) -> Optional[dict]:
    """
    Build a JSON-serializable snapshot of a SQLModel instance (table columns only).
    Returns None if obj is None. Used for old_values/new_values in audit logs.
    """
    if obj is None:
        return None
    out: dict = {}
    for key in obj.__class__.model_fields:
        try:
            v = getattr(obj, key, None)
            out[key] = _serialize_value(v)
        except Exception:
            continue
    return out


def _resolve_actor_email(
    session: Session,
    actor_user_id: Optional[str],
    actor_user: Optional[User],
) -> Optional[str]:
    """Best-effort email for durable audit display (denormalized on the row)."""
    if actor_user is not None:
        e = getattr(actor_user, "email", None)
        if e is not None and str(e).strip() != "":
            return str(e).strip()
        return None
    if actor_user_id:
        u = session.get(User, actor_user_id)
        if u is not None:
            e = getattr(u, "email", None)
            if e is not None and str(e).strip() != "":
                return str(e).strip()
    return None


def _collect_request_metadata(request: Optional[Request]) -> dict[str, Any]:
    if request is None:
        return {}
    out: dict[str, Any] = {}
    ip = get_client_ip(request)
    if ip:
        out["ip_address"] = ip
    ua = request.headers.get("user-agent")
    if ua:
        out["user_agent"] = ua
    rid = getattr(request.state, "request_id", None)
    if rid is not None and str(rid).strip() != "":
        out["request_id"] = str(rid)
    return out


def merge_audit_metadata(
    *,
    request: Optional[Request],
    source: str,
    extra: Optional[dict],
) -> Optional[dict]:
    """
    Build JSON metadata: source + optional request context + caller extras.
    Later keys win (extra overrides request-derived).
    """
    merged: dict[str, Any] = {}
    if source:
        merged["source"] = source
    merged.update(_collect_request_metadata(request))
    if extra:
        merged.update(extra)
    cleaned = {k: v for k, v in merged.items() if v is not None}
    return cleaned if cleaned else None


def _sanitize_audit_metadata(obj: Any) -> Any:
    """
    Recursively coerce values to JSON-serializable forms for JSONB storage.
    Preserves dict/list structure; leaves standard JSON scalars unchanged;
    converts datetimes to ISO strings; non-serializable leaves (e.g. MagicMock
    in tests) become str(value).
    """
    if obj is None:
        return None
    if isinstance(obj, dict):
        return {str(k): _sanitize_audit_metadata(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_audit_metadata(x) for x in obj]
    if isinstance(obj, (str, int, bool)):
        return obj
    if isinstance(obj, float):
        try:
            json.dumps(obj)
            return obj
        except (TypeError, ValueError):
            return str(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)


def create_audit_log(
    session: Session,
    actor_user_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: str,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    organization_id: Optional[str] = None,
    *,
    actor_user: Optional[User] = None,
    metadata: Optional[dict] = None,
    request: Optional[Request] = None,
    source: str = "admin_api",
) -> None:
    """
    Append one audit log row. Call after a successful create/update/delete within
    the same transaction so it commits with the write.

    - create: old_values=None, new_values=snapshot of created entity
    - update: old_values=before snapshot, new_values=after snapshot
    - delete: old_values=snapshot of deleted entity, new_values=None

    Actor: stores actor_user_id and actor_email (resolved from actor_user or DB).
    Metadata: source (default admin_api) plus request IP/UA/request_id when request is set,
    merged with optional caller metadata.
    """
    org_id = organization_id
    if org_id is None and actor_user_id:
        actor = session.get(User, actor_user_id)
        org_id = getattr(actor, "organization_id", None) if actor else None
    if not org_id or not str(org_id).strip():
        raise ValueError(
            "create_audit_log requires organization_id or resolvable actor organization"
        )

    actor_email = _resolve_actor_email(session, actor_user_id, actor_user)
    extra_meta = merge_audit_metadata(request=request, source=source, extra=metadata)
    if extra_meta is not None:
        extra_meta = _sanitize_audit_metadata(extra_meta)

    entry = AuditLog(
        organization_id=str(org_id).strip(),
        actor_user_id=actor_user_id,
        actor_email=actor_email,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
        extra_metadata=extra_meta,
    )
    session.add(entry)
