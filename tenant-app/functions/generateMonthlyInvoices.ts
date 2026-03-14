import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    // Get settings
    const settings = await base44.asServiceRole.entities.InvoiceSettings.list();
    const setting = settings[0] || {
      company_name: "FeelAtHomeNow",
      payment_due_days: 10,
      invoice_counter: 1,
      iban: "CH93 0076 2011 6238 5295 7"
    };

    // Get all active leases
    const leases = await base44.asServiceRole.entities.Lease.filter({ lease_status: "active" });

    const now = new Date();
    const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const invoiceDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(now.setDate(now.getDate() + (setting.payment_due_days || 10))).toISOString().split('T')[0];

    const created = [];
    let counter = setting.invoice_counter || 1;

    for (const lease of leases) {
      // Check if invoice already exists for this period
      const existing = await base44.asServiceRole.entities.Invoice.filter({
        lease_id: lease.id,
        period_month: periodMonth
      });

      if (existing.length > 0) {
        continue; // Skip if already created
      }

      const invoiceNumber = `INV-${now.getFullYear()}-${String(counter).padStart(4, '0')}`;
      const paymentReference = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(counter).padStart(6, '0')}`;

      // Get room-based pricing if applicable
      let rentAmount = lease.monthly_rent || 0;
      if (lease.room_name) {
        const properties = await base44.asServiceRole.entities.Property.filter({ id: lease.property_id });
        const property = properties?.[0];
        if (property?.rooms) {
          const room = property.rooms.find(r => r.name === lease.room_name);
          if (room?.monthly_rent) {
            rentAmount = room.monthly_rent;
          }
        }
      }

      const utilities = lease.utilities || 0;
      const internet = lease.internet || 0;
      const electricity = lease.electricity || 0;
      const cleaning = lease.cleaning || 0;
      const parking = lease.parking || 0;
      const totalAmount = rentAmount + utilities + internet + electricity + cleaning + parking;

      const invoice = await base44.asServiceRole.entities.Invoice.create({
        tenant_email: lease.tenant_email,
        lease_id: lease.id,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate,
        period_month: periodMonth,
        rent_amount: rentAmount,
        utilities: utilities,
        internet: internet,
        electricity: electricity,
        total_amount: totalAmount,
        status: "sent",
        payment_reference: paymentReference,
        other_charges: [
          ...(cleaning > 0 ? [{ description: "Reinigung", amount: cleaning }] : []),
          ...(parking > 0 ? [{ description: "Parkplatz", amount: parking }] : []),
        ],
      });

      // Generate PDF (call separate function)
      try {
        await base44.asServiceRole.functions.invoke('generateInvoicePDF', { invoice_id: invoice.id });
      } catch (e) {
        console.error('Error generating PDF for invoice', invoice.id, e);
      }

      created.push(invoice);
      counter++;
    }

    // Update counter
    if (settings.length > 0) {
      await base44.asServiceRole.entities.InvoiceSettings.update(settings[0].id, { invoice_counter: counter });
    }

    return Response.json({
      success: true,
      created: created.length,
      invoices: created.map(i => i.invoice_number)
    });

  } catch (error) {
    console.error('Error generating monthly invoices:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});