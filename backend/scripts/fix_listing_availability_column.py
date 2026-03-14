"""
Add availability_status column to listings table if it does not exist.

Run from backend directory:
  python -m scripts.fix_listing_availability_column
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from db.database import engine


SQL = """
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS availability_status VARCHAR DEFAULT 'available';
"""


def main():
    if engine is None:
        print("PostgreSQL is not configured (no DATABASE_URL or PG_*). Exiting.")
        sys.exit(1)

    with engine.connect() as conn:
        conn.execute(text(SQL))
        conn.commit()

    print("Success: listings.availability_status column is present (added if it was missing).")


if __name__ == "__main__":
    main()
