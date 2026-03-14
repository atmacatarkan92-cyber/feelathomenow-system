"""
Add missing columns to unit, room, tenant tables if they don't exist.
Fixes GET /api/admin/units 500 when unit table is missing type, city_id, or created_at.
Run from backend: python -m scripts.ensure_units_rooms_tenants_columns
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from db.database import engine


STATEMENTS = [
    "ALTER TABLE unit ADD COLUMN IF NOT EXISTS type VARCHAR(50)",
    "ALTER TABLE unit ADD COLUMN IF NOT EXISTS city_id VARCHAR",
    "ALTER TABLE unit ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE room ADD COLUMN IF NOT EXISTS floor INTEGER",
    "ALTER TABLE room ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
    "ALTER TABLE tenant ADD COLUMN IF NOT EXISTS phone VARCHAR(50)",
    "ALTER TABLE tenant ADD COLUMN IF NOT EXISTS company VARCHAR(200)",
    "ALTER TABLE tenant ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
]


def main():
    if engine is None:
        print("PostgreSQL not configured. Skip.")
        return
    with engine.connect() as conn:
        for stmt in STATEMENTS:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception as e:
                print("Warning:", stmt[:50], "...", e)
    print("Done. unit, room, tenant columns ensured.")


if __name__ == "__main__":
    main()
