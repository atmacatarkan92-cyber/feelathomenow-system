from db.database import get_session
from services.billing_service import generate_monthly_invoices

with get_session() as session:
    result = generate_monthly_invoices(session, 2026, 3)
    print("Created invoices:", result)