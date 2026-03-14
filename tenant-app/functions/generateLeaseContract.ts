import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jsPDF } from 'npm:jspdf@2.5.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { lease_id } = await req.json();

    if (!lease_id) {
      return Response.json({ error: 'lease_id is required' }, { status: 400 });
    }

    // Fetch lease data
    const leases = await base44.asServiceRole.entities.Lease.filter({ id: lease_id });
    if (!leases || leases.length === 0) {
      return Response.json({ error: 'Lease not found' }, { status: 404 });
    }
    const lease = leases[0];

    // Fetch property data
    const properties = await base44.asServiceRole.entities.Property.filter({ id: lease.property_id });
    const property = properties?.[0];

    if (!property) {
      return Response.json({ error: 'Property not found' }, { status: 404 });
    }

    // Generate PDF
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text('Mietvertrag', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Vertragsnummer: ${lease.id.substring(0, 8).toUpperCase()}`, 105, 28, { align: 'center' });
    
    // Vertragsparteien
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Vertragsparteien', 20, 45);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Vermieter:', 20, 55);
    doc.setFont(undefined, 'bold');
    doc.text('LivingSpace GmbH', 20, 61);
    doc.setFont(undefined, 'normal');
    doc.text('Musterstrasse 123, 8000 Zürich', 20, 67);
    
    doc.text('Mieter:', 20, 80);
    doc.setFont(undefined, 'bold');
    doc.text(lease.tenant_name || lease.tenant_email, 20, 86);
    doc.setFont(undefined, 'normal');
    doc.text(lease.tenant_email, 20, 92);
    
    // Mietobjekt
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Mietobjekt', 20, 110);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Unterkunft: ${property.title}`, 20, 120);
    doc.text(`Adresse: ${property.address}`, 20, 126);
    if (property.city) {
      doc.text(`${property.zip_code} ${property.city}`, 20, 132);
    }
    if (lease.room_name) {
      doc.text(`Zimmer/Bereich: ${lease.room_name}`, 20, 138);
    }
    
    // Mietdauer
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Mietdauer und Mietzins', 20, 156);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const moveInDate = lease.move_in_date ? new Date(lease.move_in_date).toLocaleDateString('de-CH') : '—';
    const moveOutDate = lease.move_out_date ? new Date(lease.move_out_date).toLocaleDateString('de-CH') : 'unbefristet';
    doc.text(`Mietbeginn: ${moveInDate}`, 20, 166);
    doc.text(`Mietende: ${moveOutDate}`, 20, 172);
    doc.text(`Monatlicher Mietzins: CHF ${lease.monthly_rent?.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`, 20, 178);
    doc.text(`Kaution: CHF ${lease.deposit_amount?.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`, 20, 184);
    
    // Bedingungen
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Vertragsbedingungen', 20, 202);
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    const conditions = [
      '1. Der Mietzins ist monatlich im Voraus bis spätestens am 1. des Monats zu bezahlen.',
      '2. Die Kaution ist bei Mietbeginn auf das Kautionskonto zu überweisen.',
      '3. Die Wohnung ist in einem sauberen und ordentlichen Zustand zu übergeben.',
      '4. Schäden sind unverzüglich der Verwaltung zu melden.',
      '5. Die Hausordnung ist Teil dieses Vertrags und einzuhalten.',
      '6. Kündigungsfrist: 2 Monate auf Ende eines Monats.',
      '7. Untervermietung nur mit schriftlicher Zustimmung des Vermieters.',
    ];
    
    let yPos = 212;
    conditions.forEach(condition => {
      const lines = doc.splitTextToSize(condition, 170);
      doc.text(lines, 20, yPos);
      yPos += lines.length * 5;
    });
    
    // Unterschriften
    doc.setFontSize(10);
    doc.text('Ort, Datum:', 20, 260);
    doc.text('Zürich, ' + new Date().toLocaleDateString('de-CH'), 20, 266);
    
    doc.text('Vermieter:', 20, 280);
    doc.text('_______________________', 20, 286);
    
    doc.text('Mieter:', 110, 280);
    doc.text('_______________________', 110, 286);
    
    // Convert to bytes
    const pdfBytes = doc.output('arraybuffer');
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    // Upload PDF
    const fileName = `Mietvertrag_${lease.tenant_name?.replace(/\s/g, '_') || 'Mieter'}_${new Date().toISOString().split('T')[0]}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });
    
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    
    // Save as document
    await base44.asServiceRole.entities.Document.create({
      tenant_email: lease.tenant_email,
      title: `Mietvertrag - ${property.title}`,
      category: 'lease_contract',
      file_url: file_url,
      description: `Mietvertrag vom ${new Date().toLocaleDateString('de-CH')}`,
      property_id: lease.property_id,
    });
    
    return Response.json({
      success: true,
      file_url: file_url,
      message: 'Mietvertrag erfolgreich erstellt und gespeichert',
    });
    
  } catch (error) {
    console.error('Error generating lease contract:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});