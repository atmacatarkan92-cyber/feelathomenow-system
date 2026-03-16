"""
One-off script: delete a known orphan test tenant by id.

Usage (from repository root or backend directory):
  python backend/scripts/delete_orphan_test_tenant.py

Requires DATABASE_URL (or PG_*) to be set. Uses existing project DB connection.
"""
import os
import sys

_backend_root = os.path.realpath(os.path.join(os.path.dirname(__file__), ".."))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

from db.database import get_session  # noqa: E402
from db.models import Tenant  # noqa: E402

TENANT_ID = "9110e8ca-8fb1-487d-acf0-bff76fa25649"


def main():
    if not os.environ.get("DATABASE_URL", "").strip():
        print("ERROR: DATABASE_URL is not set.")
        return

    session = get_session()
    try:
        tenant = session.get(Tenant, TENANT_ID)
        if not tenant:
            print(f"Tenant with id={TENANT_ID} not found. Nothing to delete.")
            return

        print("Found tenant:")
        print(f"  id      = {tenant.id}")
        print(f"  user_id = {tenant.user_id}")
        print(f"  name    = {tenant.name}")
        print(f"  email   = {tenant.email}")

        session.delete(tenant)
        session.commit()
        print(f"\nDeleted tenant id={TENANT_ID}.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
