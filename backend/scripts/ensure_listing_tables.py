"""
Create listing-layer tables if they do not exist. Safe to run multiple times:
SQLModel.metadata.create_all() only creates missing tables; it does not drop or alter existing ones.

Run from backend directory:
  python -m scripts.ensure_listing_tables
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Import all models so they register with SQLModel.metadata before create_db()
import db.models  # noqa: F401

from db.database import engine, create_db


def main():
    if engine is None:
        print("PostgreSQL is not configured. Set DATABASE_URL or PG_* env vars.")
        sys.exit(1)

    create_db()
    print("create_db() finished. Listing tables (cities, listings, listing_images, listing_amenities) exist or were created.")


if __name__ == "__main__":
    main()
