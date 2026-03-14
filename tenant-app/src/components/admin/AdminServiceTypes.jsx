import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2 } from "lucide-react";

export default function AdminServiceTypes() {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    name: "", description: "", category: "other", price: "", duration_minutes: "60", is_active: true, requires_approval: true
  });
  const queryClient = useQueryClient();

  const { data: services = [] } = useQuery({
    queryKey: ["admin-service-types"],
    queryFn: () => base44.entities.ServiceType.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, price: parseFloat(data.price) || 0, duration_minutes: parseInt(data.duration_minutes) || 60 };
      return editItem ? base44.entities.ServiceType.update(editItem.id, payload) : base44.entities.ServiceType.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-service-types"] });
      setShowForm(false);
      setEditItem(null);
      setForm({ name: "", description: "", category: "other", price: "", duration_minutes: "60", is_active: true, requires_approval: true });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ServiceType.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-service-types"] }),
  });

  const openEdit = (service) => {
    setEditItem(service);
    setForm({
      name: service.name,
      description: service.description || "",
      category: service.category,
      price: service.price?.toString() || "",
      duration_minutes: service.duration_minutes?.toString() || "60",
      is_active: service.is_active !== false,
      requires_approval: service.requires_approval !== false,
    });
    setShowForm(true);
  };

  const categoryLabels = {
    cleaning: "Reinigung",
    maintenance: "Wartung",
    keys: "Schlüssel",
    parking: "Parkplatz",
    checkout: "Check-out",
    other: "Sonstiges",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditItem(null); setShowForm(true); }} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />Service erstellen
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "Service bearbeiten" : "Neuer Service"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 h-20" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kategorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleaning">Reinigung</SelectItem>
                    <SelectItem value="maintenance">Wartung</SelectItem>
                    <SelectItem value="keys">Schlüssel</SelectItem>
                    <SelectItem value="parking">Parkplatz</SelectItem>
                    <SelectItem value="checkout">Check-out</SelectItem>
                    <SelectItem value="other">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preis (CHF)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Dauer (Minuten)</Label>
              <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} className="mt-1" />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm">Aktiv</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.requires_approval} onChange={(e) => setForm({ ...form, requires_approval: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm">Genehmigung erforderlich</span>
              </label>
            </div>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending} className="w-full bg-slate-900 hover:bg-slate-800">
              {saveMutation.isPending ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Service</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Preis</TableHead>
                <TableHead>Dauer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map(service => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{categoryLabels[service.category]}</Badge></TableCell>
                  <TableCell className="text-sm">CHF {service.price?.toFixed(2)}</TableCell>
                  <TableCell className="text-sm">{service.duration_minutes} min</TableCell>
                  <TableCell>
                    {service.is_active ? <Badge className="bg-green-50 text-green-700 text-xs">Aktiv</Badge> : <Badge variant="outline" className="text-xs">Inaktiv</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(service)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => deleteMutation.mutate(service.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}