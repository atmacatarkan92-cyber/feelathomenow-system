"""
One-off migration: copy inquiries from MongoDB to PostgreSQL.

Run from backend directory (requires pymongo installed temporarily if removed):
  pip install pymongo
  python -m scripts.migrate_mongo_inquiries_to_postgres

Set MONGO_URL and DB_NAME (and DATABASE_URL for Postgres) in .env.
"""
import os
import sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Load .env
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

def main():
    mongo_url = os.getenv("MONGO_URL")
    mongo_db_name = os.getenv("DB_NAME")
    if not mongo_url or not mongo_db_name:
        print("MONGO_URL and DB_NAME must be set in .env to read from MongoDB. Skipping.")
        return

    try:
        from pymongo import MongoClient
    except ImportError:
        print("pymongo not installed. Run: pip install pymongo")
        sys.exit(1)

    from db.database import engine, get_session
    from db.models import Inquiry

    if engine is None:
        print("PostgreSQL not configured (DATABASE_URL). Exiting.")
        sys.exit(1)

    client = MongoClient(mongo_url)
    db = client[mongo_db_name]
    collection = db.get_collection("inquiries")
    mongo_inquiries = list(collection.find({}))

    if not mongo_inquiries:
        print("No inquiries found in MongoDB.")
        client.close()
        return

    session = get_session()
    migrated = 0
    try:
        for doc in mongo_inquiries:
            created = doc.get("created_at")
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                except Exception:
                    created = datetime.utcnow()
            elif created is None:
                created = datetime.utcnow()

            inquiry = Inquiry(
                name=doc.get("name", ""),
                email=doc.get("email", ""),
                message=doc.get("message", ""),
                phone=doc.get("phone"),
                company=doc.get("company"),
                language=doc.get("language", "de"),
                apartment_id=doc.get("apartment_id"),
                email_sent=bool(doc.get("email_sent", False)),
                created_at=created,
            )
            session.add(inquiry)
            migrated += 1
        session.commit()
        print(f"Migrated {migrated} inquiry/ies from MongoDB to PostgreSQL.")
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        raise
    finally:
        session.close()
        client.close()


if __name__ == "__main__":
    main()
