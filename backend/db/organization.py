from sqlmodel import select

from db.models import Organization


def get_or_create_default_organization(session) -> Organization:
    """
    Backwards-compatible org bootstrap.
    For now: ensure at least one Organization exists and return it.
    """
    rows = session.exec(select(Organization).order_by(Organization.created_at).limit(1)).all()
    if rows:
        return rows[0]
    org = Organization(name="Default")
    session.add(org)
    session.commit()
    session.refresh(org)
    return org

