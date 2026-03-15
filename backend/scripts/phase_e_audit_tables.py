"""Phase E audit: list all tables and row counts. Read-only."""
import os
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")
from sqlalchemy import create_engine, text

url = os.environ.get("DATABASE_URL", "postgresql+psycopg2://postgres:postgres1905@localhost:5432/feelathomenow")
engine = create_engine(url)
with engine.connect() as c:
    r = c.execute(text("""
        SELECT t.table_name
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
    """))
    tables = [row[0] for row in r]
    print("TABLES:", tables)
    for t in tables:
        try:
            cnt = c.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar()
            print(f"  {t}: {cnt} rows")
        except Exception as e:
            print(f"  {t}: error - {e}")
