"""
Verify whether the listing-layer tables exist in PostgreSQL.

Run from backend directory:
  python -m scripts.verify_listing_tables

Or:
  python scripts/verify_listing_tables.py
"""
import sys
from pathlib import Path

# Add backend root so we can import db
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from db.database import engine


REQUIRED_TABLES = ("cities", "listings", "listing_images", "listing_amenities")


def main():
    if engine is None:
        print("PostgreSQL is not configured (no DATABASE_URL or PG_*). Skipping.")
        return

    found = set()
    with engine.connect() as conn:
        for name in REQUIRED_TABLES:
            result = conn.execute(
                text(
                    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :name"
                ),
                {"name": name},
            )
            if result.fetchone():
                found.add(name)

    missing = set(REQUIRED_TABLES) - found
    for t in REQUIRED_TABLES:
        status = "OK" if t in found else "MISSING"
        print(f"  {t}: {status}")

    if missing:
        print("\nMissing tables:", ", ".join(sorted(missing)))
        print("Run: python -m scripts.ensure_listing_tables")
        sys.exit(1)
    print("\nAll listing tables exist.")


if __name__ == "__main__":
    main()
