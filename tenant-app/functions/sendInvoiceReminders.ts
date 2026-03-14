import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const settings = await base44.asServiceRole.entities.InvoiceSettings.list();
    const setting = settings[0] || { reminder_days_after_due: 5, company_name: "FeelAtHomeNow" };

    const now = new Date();
    const reminderThreshold = new Date(now);
    reminderThreshold.setDate(reminderThreshold.getDate() - (setting.reminder_days_after_due || 5));

    // Get overdue invoices that haven't been reminded
    const invoices = await base44.asServiceRole.entities.Invoice.filter({ status: "overdue", reminder_sent: false });

    const reminded = [];

    for (const invoice of invoices) {
      const dueDate = new Date(invoice.due_date);
      if (dueDate > reminderThreshold) {
        continue; // Not yet time to remind
      }

      const leases = await base44.asServiceRole.entities.Lease.filter({ id: invoice.lease_id });
      const lease = leases?.[0];

      // Send reminder email
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: invoice.tenant_email,
          subject: `Zahlungserinnerung - Rechnung ${invoice.invoice_number}`,
          body: `
Guten Tag ${lease?.tenant_name || ''},

Dies ist eine freundliche Erinnerung, dass die folgende Rechnung überfällig ist:

Rechnungsnummer: ${invoice.invoice_number}
Betrag: CHF ${invoice.total_amount.toFixed(2)}
Fällig war: ${new Date(invoice.due_date).toLocaleDateString('de-CH')}

Bitte veranlassen Sie die Zahlung umgehend.

IBAN: ${setting.iban || ''}
Referenznummer: ${invoice.payment_reference || ''}

Bei Fragen kontaktieren Sie uns bitte.

Freundliche Grüsse
${setting.company_name || 'FeelAtHomeNow'}
          `
        });

        await base44.asServiceRole.entities.Invoice.update(invoice.id, {
          reminder_sent: true,
          reminder_sent_date: new Date().toISOString()
        });

        reminded.push(invoice.invoice_number);
      } catch (e) {
        console.error('Error sending reminder for invoice', invoice.id, e);
      }
    }

    return Response.json({
      success: true,
      reminded: reminded.length,
      invoices: reminded
    });

  } catch (error) {
    console.error('Error sending reminders:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});