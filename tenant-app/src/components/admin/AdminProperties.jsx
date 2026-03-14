import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, MapPin, Edit2, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminProperties() {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ title: "", address: "", city: "", zip_code: "", description: "", wifi_name: "", wifi_password: "" });
  const queryClient = useQueryClient();

  const { data: properties = [] } = useQuery({
    queryKey: ["admin-properties"],
    queryFn: () => base44.entities.Property.list(),
  });

  const { data: leases = [] } = useQuery({
    queryKey: ["admin-leases-props"],
    queryFn: () => base44.entities.Lease.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editItem
      ? base44.entities.Property.update(editItem.id, data)
      : base44.entities.Property.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
      setShowForm(false);
      setEditItem(null);
      setForm({ title: "", address: "", city: "", zip_code: "", description: "", wifi_name: "", wifi_password: "" });
    },
  });

  const openEdit = (p) => {
    setEditItem(p);
    setForm({ title: p.title, address: p.address, city: p.city || "", zip_code: p.zip_code || "", description: p.description || "", wifi_name: p.wifi_name || "", wifi_password: p.wifi_password || "" });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditItem(null); setForm({ title: "", address: "", city: "", zip_code: "", description: "", wifi_name: "", wifi_password: "" }); setShowForm(true); }} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />Unterkunft hinzufügen
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Unterkunft bearbeiten" : "Neue Unterkunft"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="mt-1" /></div>
            <div><Label>Adresse</Label><Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>PLZ</Label><Input value={form.zip_code} onChange={(e) => setForm({...form, zip_code: e.target.value})} className="mt-1" /></div>
              <div><Label>Stadt</Label><Input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} className="mt-1" /></div>
            </div>
            <div><Label>Beschreibung</Label><Textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>WLAN Name</Label><Input value={form.wifi_name} onChange={(e) => setForm({...form, wifi_name: e.target.value})} className="mt-1" /></div>
              <div><Label>WLAN Passwort</Label><Input value={form.wifi_password} onChange={(e) => setForm({...form, wifi_password: e.target.value})} className="mt-1" /></div>
            </div>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.title || !form.address} className="w-full bg-slate-900 hover:bg-slate-800">
              {saveMutation.isPending ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid sm:grid-cols-2 gap-4">
        {properties.map(p => {
          const tenantCount = leases.filter(l => l.property_id === p.id && l.lease_status === "active").length;
          return (
            <Card key={p.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">{p.title}</h4>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <MapPin className="w-3 h-3" />{p.address}
                    </div>
                    <Badge variant="secondary" className="mt-2 text-xs">{tenantCount} aktive Mieter</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                    <Edit2 className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}