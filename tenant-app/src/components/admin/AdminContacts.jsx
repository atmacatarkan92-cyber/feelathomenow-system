import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Phone, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const roleLabels = {
  management: "Verwaltung", rental_support: "Vermietung / Support",
  caretaker: "Hauswart", cleaning: "Reinigung", emergency: "Notfallkontakt",
};

export default function AdminContacts() {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", role: "management", phone: "", email: "", whatsapp: "", availability: "" });
  const queryClient = useQueryClient();

  const { data: contacts = [] } = useQuery({
    queryKey: ["admin-contacts"],
    queryFn: () => base44.entities.Contact.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editItem
      ? base44.entities.Contact.update(editItem.id, data)
      : base44.entities.Contact.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
      setShowForm(false);
      setEditItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contact.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-contacts"] }),
  });

  const openEdit = (c) => {
    setEditItem(c);
    setForm({ name: c.name, role: c.role, phone: c.phone || "", email: c.email || "", whatsapp: c.whatsapp || "", availability: c.availability || "" });
    setShowForm(true);
  };

  const openNew = () => {
    setEditItem(null);
    setForm({ name: "", role: "management", phone: "", email: "", whatsapp: "", availability: "" });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="bg-slate-900 hover:bg-slate-800"><Plus className="w-4 h-4 mr-2" />Kontakt hinzufügen</Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "Kontakt bearbeiten" : "Neuer Kontakt"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="mt-1" /></div>
            <div><Label>Rolle</Label>
              <Select value={form.role} onValueChange={(v) => setForm({...form, role: v})}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="mt-1" /></div>
              <div><Label>E-Mail</Label><Input value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({...form, whatsapp: e.target.value})} className="mt-1" /></div>
              <div><Label>Verfügbarkeit</Label><Input value={form.availability} onChange={(e) => setForm({...form, availability: e.target.value})} className="mt-1" /></div>
            </div>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name} className="w-full bg-slate-900 hover:bg-slate-800">Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid sm:grid-cols-2 gap-3">
        {contacts.map(c => (
          <Card key={c.id} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-sm text-slate-900">{c.name}</h4>
                <Badge variant="outline" className="text-[10px] mt-1">{roleLabels[c.role]}</Badge>
                <div className="flex gap-3 mt-2 text-xs text-slate-500">
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}><Edit2 className="w-3.5 h-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}