"""
Add tenancy/billing reference columns to invoices table if they do not exist.
Required for invoice generation from tenancies and duplicate protection.

Run from backend: python -m scripts.ensure_invoice_tenancy_columns
"""
import os
import sys
from pathlib import Path

_backend = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend))
if not os.environ.get("DATABASE_URL"):
    from dotenv import load_dotenv
    load_dotenv(_backend / ".env")

from sqlalchemy import text
from db.database import engine


def main():
    if engine is None:
        print("PostgreSQL not configured. Skip.")
        return
    statements = [
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id VARCHAR",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenancy_id VARCHAR",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS room_id VARCHAR",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS unit_id VARCHAR",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_year INTEGER",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_month INTEGER",
    ]
    with engine.connect() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        conn.commit()
    print("Invoice tenancy columns (tenant_id, tenancy_id, room_id, unit_id, billing_year, billing_month) are present.")


if __name__ == "__main__":
    main()
