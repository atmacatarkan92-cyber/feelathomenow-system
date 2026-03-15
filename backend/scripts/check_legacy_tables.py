"""Check legacy tables row counts. Run from backend dir."""
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")
from sqlalchemy import create_engine, text
url = os.environ.get("DATABASE_URL", "postgresql+psycopg2://postgres:postgres1905@localhost:5432/feelathomenow")
engine = create_engine(url)
with engine.connect() as c:
    for t in ["rooms", "units", "tenants"]:
        try:
            cnt = c.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar()
            print(f"{t}: {cnt} rows")
        except Exception as e:
            print(f"{t}: {e}")
