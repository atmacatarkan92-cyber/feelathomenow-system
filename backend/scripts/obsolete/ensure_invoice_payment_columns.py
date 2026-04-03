"""
Add payment tracking columns to invoices table if they do not exist.

Extended invoice schema (payment tracking):
  - paid_at       TIMESTAMP       when the invoice was marked paid
  - payment_method   VARCHAR(100)  e.g. bank transfer, card
  - payment_reference VARCHAR(200) reference number

Status is stored as: unpaid | paid | overdue (overdue can be derived from due_date).

Moved to scripts/obsolete/ — superseded by Alembic (invoice payment columns in baseline).

Run from backend: python -m scripts.obsolete.ensure_invoice_payment_columns
"""
import os
import sys
from pathlib import Path

# Load .env before db import
_backend = Path(__file__).resolve().parents[2]
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
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100)",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(200)",
    ]
    with engine.connect() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        conn.commit()
    print("Invoice payment columns (paid_at, payment_method, payment_reference) are present.")

if __name__ == "__main__":
    main()
