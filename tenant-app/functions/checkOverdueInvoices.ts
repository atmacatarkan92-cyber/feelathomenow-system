import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const now = new Date().toISOString().split('T')[0];

    // Get all open invoices
    const invoices = await base44.asServiceRole.entities.Invoice.filter({ status: "open" });

    const updated = [];

    for (const invoice of invoices) {
      if (invoice.due_date && invoice.due_date < now) {
        await base44.asServiceRole.entities.Invoice.update(invoice.id, { status: "overdue" });
        updated.push(invoice.invoice_number);
      }
    }

    // Also check "sent" status
    const sentInvoices = await base44.asServiceRole.entities.Invoice.filter({ status: "sent" });
    for (const invoice of sentInvoices) {
      if (invoice.due_date && invoice.due_date < now) {
        await base44.asServiceRole.entities.Invoice.update(invoice.id, { status: "overdue" });
        updated.push(invoice.invoice_number);
      }
    }

    return Response.json({
      success: true,
      updated: updated.length,
      invoices: updated
    });

  } catch (error) {
    console.error('Error checking overdue invoices:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});