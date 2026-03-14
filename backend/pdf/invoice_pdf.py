from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import os


def generate_invoice_pdf(invoice_number, tenant_id, amount, period_start, period_end):

    folder = "invoices"
    os.makedirs(folder, exist_ok=True)

    file_path = f"{folder}/{invoice_number}.pdf"

    c = canvas.Canvas(file_path, pagesize=A4)

    c.setFont("Helvetica", 12)

    c.drawString(50, 800, "FeelAtHomeNow GmbH")
    c.drawString(50, 780, "Rental Invoice")

    c.drawString(50, 740, f"Invoice Number: {invoice_number}")
    c.drawString(50, 720, f"Tenant ID: {tenant_id}")

    c.drawString(50, 680, f"Billing Period:")
    c.drawString(70, 660, f"{period_start} - {period_end}")

    c.drawString(50, 620, f"Amount: {amount} CHF")

    c.drawString(50, 580, "Payment Terms: 10 days")

    c.drawString(50, 540, "Thank you for staying with FeelAtHomeNow!")

    c.save()

    return file_path