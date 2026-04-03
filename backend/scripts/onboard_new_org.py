"""
Onboard a new organization (and optionally an org admin user).

Uses DATABASE_URL (application role, RLS-aware). Default is dry-run; pass --apply to write.

Run from backend directory:
  python -m scripts.onboard_new_org \\
    --organization-name "Acme GmbH" \\
    --organization-slug acme \\
    --create-admin \\
    --admin-email "admin@acme.com"

  python -m scripts.onboard_new_org ... --apply

Idempotency: by normalized --organization-slug when provided and the organization.slug column
exists; otherwise by exact --organization-name match (see README / migration 062).

Business rules live in app.services.organization_onboarding_service (shared with the platform API).
"""
from __future__ import annotations

import argparse
import os
import sys
from typing import Optional

_backend_root = os.path.realpath(os.path.join(os.path.dirname(__file__), ".."))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

from app.services.organization_onboarding_service import (  # noqa: E402
    OrganizationNameAmbiguousError,
    create_initial_org_admin,
    get_or_create_organization,
    normalize_slug,
    organization_slug_column_exists,
    resolve_existing_organization_by_id,
    validate_slug_format,
)
from db.database import get_session  # noqa: E402
from db.models import Organization  # noqa: E402


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Onboard organization (+ optional admin). Default: dry-run (no writes). Use --apply to persist."
    )
    p.add_argument("--organization-name", default=None, help="Display name for the new organization")
    p.add_argument(
        "--organization-slug",
        default=None,
        help="Optional unique slug (e.g. acme). When set and organization.slug exists, used for idempotency.",
    )
    p.add_argument(
        "--organization-id",
        default=None,
        help="Existing organization UUID. Skips org creation; optional slug fill if column is NULL.",
    )
    p.add_argument("--create-admin", action="store_true", help="Create org-scoped admin user")
    p.add_argument("--admin-email", default=None, help="Admin email (required with --create-admin)")
    p.add_argument("--admin-password", default=None, help="Admin password (omit to prompt when --apply)")
    p.add_argument(
        "--apply",
        action="store_true",
        help="Perform database writes. Without this flag, only read checks and planned actions are printed.",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    org_id_arg = args.organization_id.strip() if args.organization_id else None
    name = args.organization_name.strip() if args.organization_name else None
    slug_raw = args.organization_slug.strip() if args.organization_slug else None

    if org_id_arg:
        if not name:
            name = ""
    else:
        if not name:
            sys.stderr.write(
                "ERROR: --organization-name is required unless --organization-id is set.\n"
            )
            return 2

    if args.create_admin and not args.admin_email:
        sys.stderr.write("ERROR: --create-admin requires --admin-email.\n")
        return 2

    apply = bool(args.apply)
    mode = "[APPLY]" if apply else "[DRY-RUN]"

    try:
        session = get_session()
    except RuntimeError as e:
        sys.stderr.write(f"ERROR: {e}\n")
        return 1

    try:
        print(mode)

        slug_col = organization_slug_column_exists(session)
        slug_norm: Optional[str] = None
        if slug_raw and slug_col:
            slug_norm = normalize_slug(slug_raw)
            try:
                validate_slug_format(slug_norm)
            except ValueError as e:
                sys.stderr.write(f"ERROR: {e}\n")
                return 2
        elif slug_raw and not slug_col:
            sys.stderr.write(
                "WARNING: organization.slug column not found; ignoring --organization-slug "
                "(use exact --organization-name for idempotency).\n"
            )

        org: Optional[Organization] = None

        if org_id_arg:
            try:
                org, lines = resolve_existing_organization_by_id(
                    session,
                    organization_id=org_id_arg,
                    slug_norm=slug_norm,
                    slug_col=slug_col,
                    apply=apply,
                )
            except ValueError as e:
                sys.stderr.write(f"ERROR: {e}\n")
                return 1
            for line in lines:
                if line.startswith("Slug set"):
                    print(f"✔ {line}")
                else:
                    print(f"ℹ {line}")

        else:
            use_slug = bool(slug_norm) and slug_col
            try:
                org, org_msg, _created = get_or_create_organization(
                    session,
                    apply=apply,
                    organization_name=name,
                    slug=slug_norm,
                    use_slug=use_slug,
                    commit_after_organization=True,
                    reject_duplicate=False,
                )
            except OrganizationNameAmbiguousError as e:
                sys.stderr.write(e.message + "\n")
                return 1
            if "already exists" in org_msg:
                print("ℹ", org_msg)
            elif org_msg.startswith("Would create"):
                print("✔", org_msg)
            else:
                print("✔", org_msg)

        org_id: Optional[str] = str(org.id) if org else None

        if not args.create_admin:
            return 0

        if org is None and not org_id_arg:
            _ae = args.admin_email.strip().lower() if args.admin_email else ""
            print(
                f"✔ Would create admin user: {_ae!r} "
                "(after organization is created; password via prompt or --admin-password with --apply)"
            )
            return 0

        assert org_id is not None
        admin_msg = create_initial_org_admin(
            session,
            apply=apply,
            org_id=org_id,
            admin_email=args.admin_email,
            admin_password=args.admin_password,
            commit=True,
            prompt_for_password_if_missing=True,
        )
        if admin_msg.startswith("ERROR"):
            sys.stderr.write(admin_msg + "\n")
            return 1
        if "already exists" in admin_msg or "No password changes" in admin_msg:
            print("ℹ", admin_msg)
        elif admin_msg.startswith("Would create"):
            print("✔", admin_msg)
        else:
            print("✔", admin_msg)

        return 0
    except Exception as e:
        session.rollback()
        sys.stderr.write(f"ERROR: {e}\n")
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
