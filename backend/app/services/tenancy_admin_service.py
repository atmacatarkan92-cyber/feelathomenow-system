"""
Admin tenancy CRUD, participants, revenue, overlap checks, and audit side effects.

Used by routes_admin_tenancies; keeps HTTP framing in the router.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from starlette.requests import Request
from sqlalchemy import delete, func, or_
from sqlmodel import Session, select

from db.audit import create_audit_log
from db.models import (
    Tenancy,
    TenancyParticipant,
    TenancyRevenue,
    TenancyStatus,
    Tenant,
    Room,
    Unit,
    User,
)
from app.services.tenancy_lifecycle import (
    scheduling_end_date_from_parts,
    sync_tenancy_move_out_date,
    tenancy_derived_display_status,
    tenancy_display_end_date,
    tenancy_scheduling_end_date,
)


def tenant_summary_dict(t: Tenant) -> dict:
    """Minimal tenant payload nested under each participant (admin UI / CRM)."""
    return {
        "id": str(t.id),
        "first_name": getattr(t, "first_name", None),
        "last_name": getattr(t, "last_name", None),
        "email": getattr(t, "email", None) or "",
        "name": getattr(t, "name", None) or "",
    }


def tenancy_to_dict(t: Tenancy) -> dict:
    de = tenancy_display_end_date(t)
    return {
        "id": str(t.id),
        "tenant_id": str(t.tenant_id),
        "room_id": str(t.room_id),
        "unit_id": str(t.unit_id),
        "move_in_date": t.move_in_date.isoformat() if t.move_in_date else None,
        "move_out_date": t.move_out_date.isoformat() if t.move_out_date else None,
        "notice_given_at": (
            t.notice_given_at.isoformat() if getattr(t, "notice_given_at", None) else None
        ),
        "termination_effective_date": (
            t.termination_effective_date.isoformat()
            if getattr(t, "termination_effective_date", None)
            else None
        ),
        "actual_move_out_date": (
            t.actual_move_out_date.isoformat()
            if getattr(t, "actual_move_out_date", None)
            else None
        ),
        "terminated_by": getattr(t, "terminated_by", None),
        "display_end_date": de.isoformat() if de else None,
        "display_status": tenancy_derived_display_status(t),
        "monthly_rent": float(t.monthly_rent),
        "monthly_revenue_equivalent": getattr(t, "_monthly_revenue_equivalent", None),
        "deposit_amount": float(t.deposit_amount) if t.deposit_amount is not None else None,
        "tenant_deposit_type": getattr(t, "tenant_deposit_type", None),
        "tenant_deposit_amount": (
            float(getattr(t, "tenant_deposit_amount"))
            if getattr(t, "tenant_deposit_amount", None) is not None
            else None
        ),
        "tenant_deposit_annual_premium": (
            float(getattr(t, "tenant_deposit_annual_premium"))
            if getattr(t, "tenant_deposit_annual_premium", None) is not None
            else None
        ),
        "tenant_deposit_provider": getattr(t, "tenant_deposit_provider", None),
        "status": t.status.value if hasattr(t.status, "value") else str(t.status),
        "created_at": t.created_at.isoformat() if getattr(t, "created_at", None) else None,
    }


def participant_rows_by_tenancy_ids(
    session: Session, org_id: str, tenancy_ids: list[str]
) -> Dict[str, list[dict]]:
    """Load participants + tenant summaries for many tenancies (one query)."""
    if not tenancy_ids:
        return {}
    stmt = (
        select(TenancyParticipant, Tenant)
        .where(TenancyParticipant.organization_id == org_id)
        .where(TenancyParticipant.tenancy_id.in_(tenancy_ids))
        .join(Tenant, Tenant.id == TenancyParticipant.tenant_id)
    )
    pairs = list(session.exec(stmt).all())
    out: dict[str, list] = {}
    role_order = {"primary_tenant": 0, "co_tenant": 1, "solidarhafter": 2}
    for tp, tenant in pairs:
        tkey = str(tp.tenancy_id)
        out.setdefault(tkey, []).append(
            {
                "tenant_id": str(tp.tenant_id),
                "role": tp.role,
                "tenant": tenant_summary_dict(tenant),
            }
        )
    for tkey in out:
        out[tkey].sort(key=lambda x: (role_order.get(x["role"], 9), x["tenant_id"]))
    return out


def tenancy_to_response_dict(
    session: Session,
    org_id: str,
    t: Tenancy,
    pmap: Optional[Dict[str, list[dict]]] = None,
) -> dict:
    """Tenancy JSON including participants (people on this occupancy contract)."""
    d = tenancy_to_dict(t)
    tid = str(t.id)
    if pmap is not None:
        d["participants"] = pmap.get(tid, [])
    else:
        d["participants"] = participant_rows_by_tenancy_ids(session, org_id, [tid]).get(tid, [])
    return d


def validate_tenant_ids_in_org(session: Session, org_id: str, tenant_ids: list[str]) -> None:
    for raw in tenant_ids:
        tid = str(raw).strip()
        ten = session.get(Tenant, tid)
        if not ten or str(getattr(ten, "organization_id", "")) != org_id:
            raise HTTPException(status_code=404, detail="Tenant not found")


def tenancy_revenue_to_dict(r: TenancyRevenue) -> dict:
    return {
        "id": str(r.id),
        "tenancy_id": str(r.tenancy_id),
        "type": r.type,
        "amount_chf": float(r.amount_chf or 0),
        "frequency": (getattr(r, "frequency", None) or "monthly"),
        "start_date": r.start_date.isoformat() if getattr(r, "start_date", None) else None,
        "end_date": r.end_date.isoformat() if getattr(r, "end_date", None) else None,
        "notes": getattr(r, "notes", None),
        "created_at": r.created_at.isoformat() if getattr(r, "created_at", None) else None,
        "updated_at": r.updated_at.isoformat() if getattr(r, "updated_at", None) else None,
    }


def monthly_equivalent_amount(freq: str, amount_chf: float) -> float:
    f = str(freq or "monthly").strip().lower()
    if f == "monthly":
        return amount_chf
    if f == "yearly":
        return amount_chf / 12.0
    return 0.0


def overlap_days(a_start: date, a_end: date, b_start: date, b_end: date) -> int:
    start = max(a_start, b_start)
    end = min(a_end, b_end)
    if end < start:
        return 0
    return (end - start).days + 1


def monthly_revenue_equivalent_for_tenancy_on_date(
    tenancy: Tenancy, revenue_rows: list[TenancyRevenue], on_date: date
) -> float:
    """
    Simple monthly-equivalent (not prorated): sum revenue rows active on on_date.
    Used for UI display; profit/KPI uses revenue_forecast for proration by month overlap.
    """
    if tenancy is None:
        return 0.0
    if tenancy.status not in (TenancyStatus.active, TenancyStatus.reserved):
        return 0.0
    if tenancy.move_in_date and on_date < tenancy.move_in_date:
        return 0.0
    sched_end = tenancy_scheduling_end_date(tenancy)
    if sched_end and on_date > sched_end:
        return 0.0
    total = 0.0
    for r in revenue_rows or []:
        f = str(getattr(r, "frequency", None) or "monthly").strip().lower()
        if f == "one_time":
            continue
        sd = getattr(r, "start_date", None) or tenancy.move_in_date
        ed = getattr(r, "end_date", None) or sched_end or date(9999, 12, 31)
        if on_date < sd or on_date > ed:
            continue
        total += monthly_equivalent_amount(f, float(getattr(r, "amount_chf", 0) or 0))
    return round(total, 2)


def batch_attach_monthly_revenue_equivalent(session: Session, tenancies: list[Tenancy]) -> None:
    """
    Batch-load TenancyRevenue for the given tenancies and set t._monthly_revenue_equivalent
    using monthly_revenue_equivalent_for_tenancy_on_date (same semantics as room tenancy list).
    """
    if not tenancies:
        return
    ids = [str(t.id) for t in tenancies]
    rev_rows: list[TenancyRevenue] = (
        list(session.exec(select(TenancyRevenue).where(TenancyRevenue.tenancy_id.in_(ids))).all())
        if ids
        else []
    )
    by_tid: dict[str, list[TenancyRevenue]] = {}
    for r in rev_rows:
        by_tid.setdefault(str(r.tenancy_id), []).append(r)
    today = date.today()
    for t in tenancies:
        rows = by_tid.get(str(t.id), [])
        t._monthly_revenue_equivalent = monthly_revenue_equivalent_for_tenancy_on_date(
            t, rows, today
        )


def validate_relations(session: Session, tenant_id: str, room_id: str, unit_id: str, org_id: str) -> Room:
    tenant = session.get(Tenant, tenant_id)
    if not tenant or str(getattr(tenant, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Tenant not found")
    room = session.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    unit = session.get(Unit, unit_id)
    if not unit or str(getattr(unit, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Unit not found")
    if str(room.unit_id) != str(unit_id):
        raise HTTPException(status_code=400, detail="Room does not belong to unit")
    return room


def tenancy_audit_payload(t: Tenancy) -> dict:
    """Snapshot for parent-stream audit (tenant + unit timelines)."""
    return tenancy_to_dict(t)


def tenancy_revenue_audit_payload(r: TenancyRevenue) -> dict:
    return tenancy_revenue_to_dict(r)


def parent_audit_payloads_equal(a: dict, b: dict) -> bool:
    return json.dumps(a, sort_keys=True, default=str) == json.dumps(b, sort_keys=True, default=str)


def log_parent_stream_same_change(
    session: Session,
    actor_user_id: str,
    action: str,
    tenant_id: str,
    unit_id: str,
    old_values: Optional[dict],
    new_values: Optional[dict],
    organization_id: str,
    request: Optional[Request] = None,
) -> None:
    """
    Same logical change on tenant and unit parent streams (namespaced payloads).
    Reuse for tenancy/revenue; assignments/invoices/communications can follow later.
    """
    create_audit_log(
        session,
        actor_user_id,
        action,
        "tenant",
        tenant_id,
        old_values=old_values,
        new_values=new_values,
        organization_id=organization_id,
        request=request,
    )
    create_audit_log(
        session,
        actor_user_id,
        action,
        "unit",
        unit_id,
        old_values=old_values,
        new_values=new_values,
        organization_id=organization_id,
        request=request,
    )


def overlaps(
    session: Session,
    room_id: str,
    move_in: date,
    move_out: Optional[date],
    org_id: str,
    exclude_tenancy_id: Optional[str] = None,
) -> bool:
    """True if another tenancy for this room overlaps the given date range."""
    q = select(Tenancy).where(
        Tenancy.room_id == room_id,
        Tenancy.organization_id == org_id,
        Tenancy.status.in_([TenancyStatus.active, TenancyStatus.reserved]),
    )
    if exclude_tenancy_id:
        q = q.where(Tenancy.id != exclude_tenancy_id)
    for t in session.exec(q).all():
        t_end = tenancy_scheduling_end_date(t) or date(9999, 12, 31)
        our_end = move_out or date(9999, 12, 31)
        if move_in < t_end and our_end > t.move_in_date:
            return True
    return False


def list_tenancies(
    session: Session,
    org_id: str,
    *,
    room_id: Optional[str],
    unit_id: Optional[str],
    tenant_id: Optional[str],
    include_participant: bool,
    status: Optional[str],
    skip: int,
    limit: int,
) -> dict:
    """Returns dict with items, total, skip, limit (TenancyListResponse shape)."""
    base_query = (
        select(Tenancy)
        .where(Tenancy.organization_id == org_id)
        .order_by(Tenancy.move_in_date.desc())
    )
    if room_id:
        base_query = base_query.where(Tenancy.room_id == room_id)
    if unit_id:
        base_query = base_query.where(Tenancy.unit_id == unit_id)
    if tenant_id:
        if include_participant:
            tp_tenancy_ids = select(TenancyParticipant.tenancy_id).where(
                TenancyParticipant.organization_id == org_id,
                TenancyParticipant.tenant_id == tenant_id,
            )
            base_query = base_query.where(
                or_(Tenancy.tenant_id == tenant_id, Tenancy.id.in_(tp_tenancy_ids))
            )
        else:
            base_query = base_query.where(Tenancy.tenant_id == tenant_id)
    if status:
        base_query = base_query.where(Tenancy.status == status)
    count_query = (
        select(func.count())
        .select_from(Tenancy)
        .where(Tenancy.organization_id == org_id)
    )
    if room_id:
        count_query = count_query.where(Tenancy.room_id == room_id)
    if unit_id:
        count_query = count_query.where(Tenancy.unit_id == unit_id)
    if tenant_id:
        if include_participant:
            tp_tenancy_ids_c = select(TenancyParticipant.tenancy_id).where(
                TenancyParticipant.organization_id == org_id,
                TenancyParticipant.tenant_id == tenant_id,
            )
            count_query = count_query.where(
                or_(Tenancy.tenant_id == tenant_id, Tenancy.id.in_(tp_tenancy_ids_c))
            )
        else:
            count_query = count_query.where(Tenancy.tenant_id == tenant_id)
    if status:
        count_query = count_query.where(Tenancy.status == status)
    _total_rows = session.exec(count_query).all()
    total = int(_total_rows[0]) if _total_rows else 0
    paged_rows = list(session.exec(base_query.offset(skip).limit(limit)).all())
    batch_attach_monthly_revenue_equivalent(session, paged_rows)
    pmap = participant_rows_by_tenancy_ids(session, org_id, [str(t.id) for t in paged_rows])
    items = [tenancy_to_response_dict(session, org_id, t, pmap) for t in paged_rows]
    return {"items": items, "total": total, "skip": skip, "limit": limit}


def list_tenancies_for_room(session: Session, org_id: str, room_id: str) -> list:
    room = session.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    unit = session.get(Unit, room.unit_id)
    if not unit or str(getattr(unit, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Room not found")
    q = (
        select(Tenancy)
        .where(Tenancy.room_id == room_id, Tenancy.organization_id == org_id)
        .order_by(Tenancy.move_in_date.desc())
    )
    tenancies = list(session.exec(q).all())
    batch_attach_monthly_revenue_equivalent(session, tenancies)
    pmap = participant_rows_by_tenancy_ids(session, org_id, [str(t.id) for t in tenancies])
    return [tenancy_to_response_dict(session, org_id, t, pmap) for t in tenancies]


def create_tenancy(
    session: Session,
    org_id: str,
    current_user_id: str,
    body: Any,
    request: Optional[Request] = None,
) -> dict:
    """Create tenancy + participants; commit. body is validated TenancyCreate."""
    validate_relations(session, body.tenant_id, body.room_id, body.unit_id, org_id)
    status = body.status
    eff_move_out = scheduling_end_date_from_parts(
        body.move_out_date,
        body.termination_effective_date,
        body.actual_move_out_date,
    )
    if overlaps(session, body.room_id, body.move_in_date, eff_move_out, org_id):
        raise HTTPException(status_code=400, detail="Another tenancy overlaps this room for the given dates")
    tenancy = Tenancy(
        organization_id=org_id,
        tenant_id=body.tenant_id,
        room_id=body.room_id,
        unit_id=body.unit_id,
        move_in_date=body.move_in_date,
        move_out_date=body.move_out_date,
        notice_given_at=body.notice_given_at,
        termination_effective_date=body.termination_effective_date,
        actual_move_out_date=body.actual_move_out_date,
        terminated_by=body.terminated_by,
        monthly_rent=body.monthly_rent,
        deposit_amount=body.deposit_amount,
        tenant_deposit_type=body.tenant_deposit_type,
        tenant_deposit_amount=body.tenant_deposit_amount,
        tenant_deposit_annual_premium=body.tenant_deposit_annual_premium,
        tenant_deposit_provider=body.tenant_deposit_provider,
        status=status,
    )
    sync_tenancy_move_out_date(tenancy)
    session.add(tenancy)
    session.flush()
    if body.participants:
        pids = [p.tenant_id for p in body.participants]
        validate_tenant_ids_in_org(session, org_id, pids)
        for p in body.participants:
            session.add(
                TenancyParticipant(
                    organization_id=org_id,
                    tenancy_id=str(tenancy.id),
                    tenant_id=p.tenant_id,
                    role=p.role,
                )
            )
    else:
        session.add(
            TenancyParticipant(
                organization_id=org_id,
                tenancy_id=str(tenancy.id),
                tenant_id=body.tenant_id,
                role="primary_tenant",
            )
        )
    session.flush()
    batch_attach_monthly_revenue_equivalent(session, [tenancy])
    pay = {"tenancy": tenancy_audit_payload(tenancy)}
    log_parent_stream_same_change(
        session,
        str(current_user_id),
        "create",
        str(body.tenant_id),
        str(body.unit_id),
        None,
        pay,
        org_id,
        request=request,
    )
    session.commit()
    session.refresh(tenancy)
    return tenancy_to_response_dict(session, org_id, tenancy, None)


def patch_tenancy(
    session: Session,
    org_id: str,
    current_user_id: str,
    tenancy_id: str,
    body: Any,
    request: Optional[Request] = None,
) -> dict:
    """Patch tenancy; commit."""
    tenancy = session.get(Tenancy, tenancy_id)
    if not tenancy or str(getattr(tenancy, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Tenancy not found")
    old_tenancy_payload = tenancy_audit_payload(tenancy)
    data = body.model_dump(exclude_unset=True)
    participants_changed = False
    if "participants" in data and body.participants is not None:
        participants_changed = True
        pids = [p.tenant_id for p in body.participants]
        validate_tenant_ids_in_org(session, org_id, pids)
        session.exec(
            delete(TenancyParticipant).where(TenancyParticipant.tenancy_id == tenancy_id)
        )
        session.flush()
        primary_tid = None
        for p in body.participants:
            session.add(
                TenancyParticipant(
                    organization_id=org_id,
                    tenancy_id=tenancy_id,
                    tenant_id=p.tenant_id,
                    role=p.role,
                )
            )
            if p.role == "primary_tenant":
                primary_tid = p.tenant_id
        if primary_tid:
            tenancy.tenant_id = primary_tid
        data.pop("participants", None)
    if data:
        merged = tenancy.model_dump()
        merged.update(data)
        try:
            t_prop = Tenancy.model_validate(merged)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        sync_tenancy_move_out_date(t_prop)
        if t_prop.move_out_date is not None and t_prop.move_out_date < t_prop.move_in_date:
            raise HTTPException(status_code=400, detail="move_out_date must be on/after move_in_date")
        if overlaps(
            session,
            t_prop.room_id,
            t_prop.move_in_date,
            t_prop.move_out_date,
            org_id,
            exclude_tenancy_id=tenancy_id,
        ):
            raise HTTPException(status_code=400, detail="Another tenancy overlaps this room for the given dates")
        for k, v in data.items():
            if hasattr(tenancy, k):
                setattr(tenancy, k, v)
        sync_tenancy_move_out_date(tenancy)
    session.add(tenancy)
    batch_attach_monthly_revenue_equivalent(session, [tenancy])
    new_tenancy_payload = tenancy_audit_payload(tenancy)

    tenancy_payload_differs = not parent_audit_payloads_equal(
        {"tenancy": old_tenancy_payload}, {"tenancy": new_tenancy_payload}
    )
    if participants_changed or (bool(data) and tenancy_payload_differs):
        log_parent_stream_same_change(
            session,
            str(current_user_id),
            "update",
            str(tenancy.tenant_id),
            str(tenancy.unit_id),
            {"tenancy": old_tenancy_payload},
            {"tenancy": new_tenancy_payload},
            org_id,
            request=request,
        )
    session.commit()
    session.refresh(tenancy)
    return tenancy_to_response_dict(session, org_id, tenancy, None)


def delete_tenancy(
    session: Session,
    org_id: str,
    current_user_id: str,
    tenancy_id: str,
    request: Optional[Request] = None,
) -> dict:
    tenancy = session.get(Tenancy, tenancy_id)
    if not tenancy or str(getattr(tenancy, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Tenancy not found")
    tid = str(tenancy.tenant_id)
    uid = str(tenancy.unit_id)
    old_pay = {"tenancy": tenancy_audit_payload(tenancy)}
    session.delete(tenancy)
    log_parent_stream_same_change(
        session,
        str(current_user_id),
        "delete",
        tid,
        uid,
        old_pay,
        None,
        org_id,
        request=request,
    )
    session.commit()
    return {"status": "ok", "message": "Tenancy deleted"}


def list_tenancy_revenue(session: Session, org_id: str, tenancy_id: str) -> list:
    tenancy = session.get(Tenancy, tenancy_id)
    if not tenancy or str(getattr(tenancy, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Tenancy not found")
    rows = list(
        session.exec(
            select(TenancyRevenue)
            .where(TenancyRevenue.tenancy_id == tenancy_id)
            .where(TenancyRevenue.organization_id == org_id)
            .order_by(TenancyRevenue.created_at)
        ).all()
    )
    return [tenancy_revenue_to_dict(r) for r in rows]


def create_tenancy_revenue(
    session: Session,
    org_id: str,
    current_user_id: str,
    tenancy_id: str,
    body: Any,
    request: Optional[Request] = None,
) -> dict:
    tenancy = session.get(Tenancy, tenancy_id)
    if not tenancy or str(getattr(tenancy, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Tenancy not found")
    row = TenancyRevenue(
        organization_id=org_id,
        tenancy_id=tenancy_id,
        type=body.type,
        amount_chf=float(body.amount_chf),
        frequency=(body.frequency or "monthly"),
        start_date=body.start_date,
        end_date=body.end_date,
        notes=(body.notes.strip() if isinstance(body.notes, str) and body.notes.strip() else None),
        created_at=datetime.utcnow(),
        updated_at=None,
    )
    session.add(row)
    session.flush()
    rev_pay = {"tenancy_revenue": tenancy_revenue_audit_payload(row)}
    log_parent_stream_same_change(
        session,
        str(current_user_id),
        "create",
        str(tenancy.tenant_id),
        str(tenancy.unit_id),
        None,
        rev_pay,
        org_id,
        request=request,
    )
    session.commit()
    session.refresh(row)
    return tenancy_revenue_to_dict(row)


def patch_tenancy_revenue(
    session: Session,
    org_id: str,
    current_user_id: str,
    revenue_id: str,
    body: Any,
    request: Optional[Request] = None,
) -> dict:
    row = session.get(TenancyRevenue, revenue_id)
    if not row or str(getattr(row, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Revenue row not found")
    tenancy = session.get(Tenancy, str(row.tenancy_id))
    if not tenancy or str(getattr(tenancy, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Tenancy not found")
    old_pay = {"tenancy_revenue": tenancy_revenue_audit_payload(row)}
    data = body.model_dump(exclude_unset=True)
    if "type" in data:
        row.type = data["type"]
    if "amount_chf" in data:
        row.amount_chf = float(data["amount_chf"])
    if "frequency" in data:
        row.frequency = data["frequency"] or "monthly"
    if "start_date" in data:
        row.start_date = data["start_date"]
    if "end_date" in data:
        row.end_date = data["end_date"]
    if "notes" in data:
        n = data["notes"]
        row.notes = n.strip() if isinstance(n, str) and n.strip() else None
    if row.start_date is not None and row.end_date is not None and row.end_date < row.start_date:
        raise HTTPException(status_code=400, detail="end_date must be on/after start_date")
    row.updated_at = datetime.utcnow()
    session.add(row)
    new_pay = {"tenancy_revenue": tenancy_revenue_audit_payload(row)}
    if not parent_audit_payloads_equal(old_pay, new_pay):
        log_parent_stream_same_change(
            session,
            str(current_user_id),
            "update",
            str(tenancy.tenant_id),
            str(tenancy.unit_id),
            old_pay,
            new_pay,
            org_id,
            request=request,
        )
    session.commit()
    session.refresh(row)
    return tenancy_revenue_to_dict(row)


def delete_tenancy_revenue(
    session: Session,
    org_id: str,
    current_user_id: str,
    revenue_id: str,
    request: Optional[Request] = None,
) -> dict:
    row = session.get(TenancyRevenue, revenue_id)
    if not row or str(getattr(row, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Revenue row not found")
    tenancy = session.get(Tenancy, str(row.tenancy_id))
    if not tenancy or str(getattr(tenancy, "organization_id", "")) != org_id:
        raise HTTPException(status_code=404, detail="Tenancy not found")
    old_pay = {"tenancy_revenue": tenancy_revenue_audit_payload(row)}
    session.delete(row)
    log_parent_stream_same_change(
        session,
        str(current_user_id),
        "delete",
        str(tenancy.tenant_id),
        str(tenancy.unit_id),
        old_pay,
        None,
        org_id,
        request=request,
    )
    session.commit()
    return {"status": "ok"}
