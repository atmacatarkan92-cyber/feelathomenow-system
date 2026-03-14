import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminLeaseForm({ form, setForm, properties }) {
  const selectedProperty = properties.find(p => p.id === form.property_id);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Mieter E-Mail</Label>
          <Input value={form.tenant_email} onChange={(e) => setForm({ ...form, tenant_email: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Mieter Name</Label>
          <Input value={form.tenant_name} onChange={(e) => setForm({ ...form, tenant_name: e.target.value })} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Unterkunft</Label>
          <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v, room_name: "" })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Wählen" /></SelectTrigger>
            <SelectContent>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {selectedProperty?.rooms && selectedProperty.rooms.length > 0 && (
          <div>
            <Label>Zimmer (optional)</Label>
            <Select value={form.room_name} onValueChange={(v) => setForm({ ...form, room_name: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Gesamte Wohnung" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Gesamte Wohnung</SelectItem>
                {selectedProperty.rooms.map((r, i) => <SelectItem key={i} value={r.name}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Einzugsdatum</Label>
          <Input type="date" value={form.move_in_date} onChange={(e) => setForm({ ...form, move_in_date: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Auszugsdatum</Label>
          <Input type="date" value={form.move_out_date} onChange={(e) => setForm({ ...form, move_out_date: e.target.value })} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Monatsmiete (CHF)</Label>
          <Input type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Nebenkosten (CHF)</Label>
          <Input type="number" value={form.utilities} onChange={(e) => setForm({ ...form, utilities: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Internet (CHF)</Label>
          <Input type="number" value={form.internet} onChange={(e) => setForm({ ...form, internet: e.target.value })} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Strom (CHF)</Label>
          <Input type="number" value={form.electricity} onChange={(e) => setForm({ ...form, electricity: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Reinigung (CHF)</Label>
          <Input type="number" value={form.cleaning} onChange={(e) => setForm({ ...form, cleaning: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Parkplatz (CHF)</Label>
          <Input type="number" value={form.parking} onChange={(e) => setForm({ ...form, parking: e.target.value })} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Kaution (CHF)</Label>
          <Input type="number" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Kautionsstatus</Label>
          <Select value={form.deposit_status} onValueChange={(v) => setForm({ ...form, deposit_status: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Ausstehend</SelectItem>
              <SelectItem value="paid">Bezahlt</SelectItem>
              <SelectItem value="partially_paid">Teilweise bezahlt</SelectItem>
              <SelectItem value="returned">Zurückerstattet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Status</Label>
        <Select value={form.lease_status} onValueChange={(v) => setForm({ ...form, lease_status: v })}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Bevorstehend</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="ended">Beendet</SelectItem>
            <SelectItem value="terminated">Gekündigt</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}