import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jsPDF } from 'npm:jspdf@2.5.1';
import QRCode from 'npm:qrcode@1.5.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { invoice_id } = await req.json();

    const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: invoice_id });
    if (!invoices || invoices.length === 0) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const invoice = invoices[0];

    const leases = await base44.asServiceRole.entities.Lease.filter({ id: invoice.lease_id });
    const lease = leases?.[0];

    const properties = lease ? await base44.asServiceRole.entities.Property.filter({ id: lease.property_id }) : [];
    const property = properties?.[0];

    const settings = await base44.asServiceRole.entities.InvoiceSettings.list();
    const setting = settings[0] || {
      company_name: "FeelAtHomeNow",
      company_address: "Musterstrasse 123",
      company_city: "8000 Zürich",
      iban: "CH93 0076 2011 6238 5295 7"
    };

    const doc = new jsPDF();

    // Header
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('Rechnung', 20, 25);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(setting.company_name || 'FeelAtHomeNow', 20, 35);
    doc.text(setting.company_address || 'Musterstrasse 123', 20, 40);
    doc.text(setting.company_city || '8000 Zürich', 20, 45);

    // Invoice details (right side)
    doc.setFontSize(10);
    doc.text(`Rechnungsnummer: ${invoice.invoice_number}`, 140, 35);
    doc.text(`Rechnungsdatum: ${new Date(invoice.invoice_date).toLocaleDateString('de-CH')}`, 140, 40);
    doc.text(`Fälligkeitsdatum: ${new Date(invoice.due_date).toLocaleDateString('de-CH')}`, 140, 45);
    doc.text(`Periode: ${invoice.period_month}`, 140, 50);

    // Recipient
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Rechnung an:', 20, 65);
    doc.setFont(undefined, 'normal');
    doc.text(lease?.tenant_name || invoice.tenant_email, 20, 71);
    doc.text(invoice.tenant_email, 20, 76);
    if (property) {
      doc.text(property.address, 20, 81);
      if (property.city) {
        doc.text(`${property.zip_code} ${property.city}`, 20, 86);
      }
    }

    // Line items
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Position', 20, 105);
    doc.text('Betrag (CHF)', 160, 105, { align: 'right' });

    doc.setLineWidth(0.5);
    doc.line(20, 107, 190, 107);

    let yPos = 115;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);

    const items = [
      { label: lease?.room_name ? `Miete - ${lease.room_name}` : 'Miete', amount: invoice.rent_amount },
      { label: 'Nebenkosten', amount: invoice.utilities },
      { label: 'Internet', amount: invoice.internet },
      { label: 'Strom', amount: invoice.electricity },
    ];

    items.forEach(item => {
      if (item.amount > 0) {
        doc.text(item.label, 20, yPos);
        doc.text(item.amount.toFixed(2), 190, yPos, { align: 'right' });
        yPos += 6;
      }
    });

    if (invoice.other_charges && invoice.other_charges.length > 0) {
      invoice.other_charges.forEach(charge => {
        doc.text(charge.description, 20, yPos);
        doc.text(charge.amount.toFixed(2), 190, yPos, { align: 'right' });
        yPos += 6;
      });
    }

    // Total
    yPos += 5;
    doc.setLineWidth(0.5);
    doc.line(20, yPos, 190, yPos);
    yPos += 8;

    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('Total CHF', 20, yPos);
    doc.text(invoice.total_amount.toFixed(2), 190, yPos, { align: 'right' });

    // Payment info
    yPos += 15;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Zahlungsinformationen', 20, yPos);
    doc.setFont(undefined, 'normal');
    yPos += 6;
    doc.text(`IBAN: ${setting.iban}`, 20, yPos);
    yPos += 5;
    doc.text(`Referenznummer: ${invoice.payment_reference || ''}`, 20, yPos);
    yPos += 5;
    doc.text(`Zahlbar bis: ${new Date(invoice.due_date).toLocaleDateString('de-CH')}`, 20, yPos);

    // QR-Bill generation
    const qrData = [
      'SPC', // QR type
      '0200', // Version
      '1', // Coding type
      setting.iban || 'CH93 0076 2011 6238 5295 7',
      'K', // Creditor address type
      setting.company_name || 'LivingSpace GmbH',
      setting.company_address || 'Musterstrasse 123',
      setting.company_city || '8000 Zürich',
      '', '', // Additional address lines
      'CH',
      '', '', '', '', '', '', // Debtor info (empty)
      invoice.total_amount.toFixed(2),
      'CHF',
      '', '', '', '', '', '', // Ultimate debtor (empty)
      'QRR', // Reference type
      invoice.payment_reference || '',
      invoice.notes || `Miete ${invoice.period_month}`,
      'EPD', // Additional info
    ].join('\n');

    const qrCodeDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });

    // Add QR code to PDF (Swiss QR-Bill position)
    doc.addPage();
    doc.setFontSize(8);
    doc.text('Zahlteil', 20, 20);
    doc.addImage(qrCodeDataUrl, 'PNG', 20, 25, 50, 50);

    doc.setFontSize(7);
    doc.text('Konto / Zahlbar an', 80, 30);
    doc.setFontSize(8);
    doc.text(setting.iban || '', 80, 35);
    doc.text(setting.company_name || '', 80, 40);
    doc.text(setting.company_address || '', 80, 45);
    doc.text(setting.company_city || '', 80, 50);

    doc.setFontSize(7);
    doc.text('Zahlbar durch', 80, 60);
    doc.setFontSize(8);
    doc.text(lease?.tenant_name || invoice.tenant_email, 80, 65);
    doc.text(invoice.tenant_email, 80, 70);

    doc.setFontSize(7);
    doc.text('Währung', 140, 30);
    doc.setFontSize(10);
    doc.text('CHF', 140, 35);

    doc.setFontSize(7);
    doc.text('Betrag', 160, 30);
    doc.setFontSize(10);
    doc.text(invoice.total_amount.toFixed(2), 160, 35);

    // Save PDF
    const pdfBytes = doc.output('arraybuffer');
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const fileName = `Rechnung_${invoice.invoice_number}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    // Update invoice with PDF URL
    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      pdf_url: file_url,
      qr_bill_url: file_url // Same PDF contains QR-Bill
    });

    // Save as document for tenant
    await base44.asServiceRole.entities.Document.create({
      tenant_email: invoice.tenant_email,
      title: `Rechnung ${invoice.invoice_number} - ${invoice.period_month}`,
      category: 'invoice',
      file_url: file_url,
      description: `Miete ${invoice.period_month}, Fällig: ${new Date(invoice.due_date).toLocaleDateString('de-CH')}`,
    });

    // Send email to tenant
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: invoice.tenant_email,
        subject: `Neue Rechnung ${invoice.invoice_number} - ${invoice.period_month}`,
        body: `
Guten Tag ${lease?.tenant_name || ''},

Ihre Rechnung für ${invoice.period_month} ist verfügbar.

Rechnungsnummer: ${invoice.invoice_number}
Betrag: CHF ${invoice.total_amount.toFixed(2)}
Fällig am: ${new Date(invoice.due_date).toLocaleDateString('de-CH')}

Sie können die Rechnung in Ihrem Tenant Portal herunterladen oder über folgenden Link:
${file_url}

Zahlungsinformationen:
IBAN: ${setting.iban}
Referenznummer: ${invoice.payment_reference}

Freundliche Grüsse
${setting.company_name || 'FeelAtHomeNow'}
        `
      });
    } catch (e) {
      console.error('Error sending email:', e);
    }

    return Response.json({
      success: true,
      pdf_url: file_url,
      invoice_number: invoice.invoice_number
    });

  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});