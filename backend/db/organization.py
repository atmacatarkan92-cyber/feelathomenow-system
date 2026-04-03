from sqlmodel import select

from db.models import Organization

# Shell organization for Vantio platform_operator users (platform_admin role).
# Keeps users.organization_id non-null without granting customer-org admin APIs.
PLATFORM_ORG_SLUG = "vantio-platform"
PLATFORM_ORG_NAME = "Vantio Platform"


def get_or_create_platform_organization(session) -> Organization:
    """Idempotent: return the platform shell org used for platform_admin users' organization_id."""
    existing = session.exec(
        select(Organization).where(Organization.slug == PLATFORM_ORG_SLUG)
    ).first()
    if existing:
        return existing
    org = Organization(name=PLATFORM_ORG_NAME, slug=PLATFORM_ORG_SLUG)
    session.add(org)
    session.commit()
    session.refresh(org)
    return org


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

