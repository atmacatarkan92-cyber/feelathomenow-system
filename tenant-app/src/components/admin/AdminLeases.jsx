import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import StatusBadge from "../shared/StatusBadge";

export default function AdminLeases() {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    tenant_email: "", tenant_name: "", property_id: "", room_name: "",
    move_in_date: "", move_out_date: "", monthly_rent: "", deposit_amount: "",
    utilities: "", internet: "", electricity: "", cleaning: "", parking: "",
    deposit_status: "pending", lease_status: "active"
  });
  const queryClient = useQueryClient();

  const { data: leases = [] } = useQuery({
    queryKey: ["admin-all-leases"],
    queryFn: () => base44.entities.Lease.list("-move_in_date"),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["admin-lease-properties"],
    queryFn: () => base44.entities.Property.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["admin-lease-users"],
    queryFn: () => base44.entities.User.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        monthly_rent: parseFloat(data.monthly_rent) || 0,
        utilities: parseFloat(data.utilities) || 0,
        internet: parseFloat(data.internet) || 0,
        electricity: parseFloat(data.electricity) || 0,
        cleaning: parseFloat(data.cleaning) || 0,
        parking: parseFloat(data.parking) || 0,
        deposit_amount: parseFloat(data.deposit_amount) || 0,
      };
      return editItem
        ? base44.entities.Lease.update(editItem.id, payload)
        : base44.entities.Lease.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-leases"] });
      setShowForm(false);
      setEditItem(null);
      setForm({
        tenant_email: "", tenant_name: "", property_id: "", room_name: "",
        move_in_date: "", move_out_date: "", monthly_rent: "", deposit_amount: "",
        utilities: "", internet: "", electricity: "", cleaning: "", parking: "",
        deposit_status: "pending", lease_status: "active"
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lease.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-all-leases"] }),
  });

  const generateContractMutation = useMutation({
    mutationFn: async (lease_id) => {
      const response = await base44.functions.invoke('generateLeaseContract', { lease_id });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Mietvertrag erfolgreich erstellt und im Dokumenten-Bereich gespeichert');
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
    },
    onError: (error) => {
      toast.error('Fehler beim Erstellen des Mietvertrags: ' + error.message);
    },
  });

  const openEdit = (lease) => {
    setEditItem(lease);
    setForm({
      tenant_email: lease.tenant_email || "",
      tenant_name: lease.tenant_name || "",
      property_id: lease.property_id || "",
      room_name: lease.room_name || "",
      move_in_date: lease.move_in_date || "",
      move_out_date: lease.move_out_date || "",
      monthly_rent: lease.monthly_rent?.toString() || "",
      utilities: lease.utilities?.toString() || "",
      internet: lease.internet?.toString() || "",
      electricity: lease.electricity?.toString() || "",
      cleaning: lease.cleaning?.toString() || "",
      parking: lease.parking?.toString() || "",
      deposit_amount: lease.deposit_amount?.toString() || "",
      deposit_status: lease.deposit_status || "pending",
      lease_status: lease.lease_status || "active",
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditItem(null);
    setForm({
      tenant_email: "", tenant_name: "", property_id: "", room_name: "",
      move_in_date: "", move_out_date: "", monthly_rent: "", deposit_amount: "",
      utilities: "", internet: "", electricity: "", cleaning: "", parking: "",
      deposit_status: "pending", lease_status: "active"
    });
    setShowForm(true);
  };

  const filtered = leases.filter(l =>
    (l.tenant_email || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.tenant_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const tenants = users.filter(u => u.role === "tenant" || !u.role || u.role === "user");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openNew} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />Mietvertrag erstellen
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Mietvertrag bearbeiten" : "Neuer Mietvertrag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <Label>Mieter auswählen</Label>
              <Select value={form.tenant_email} onValueChange={(v) => {
                const user = tenants.find(u => u.email === v);
                setForm({ ...form, tenant_email: v, tenant_name: user?.full_name || "" });
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Mieter wählen" /></SelectTrigger>
                <SelectContent>
                  {tenants.map(u => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Unterkunft</Label>
              <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Unterkunft wählen" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Zimmer / Bereich (optional)</Label>
              <Input value={form.room_name} onChange={(e) => setForm({ ...form, room_name: e.target.value })} className="mt-1" placeholder="z.B. Zimmer 3A" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Einzugsdatum</Label>
                <Input type="date" value={form.move_in_date} onChange={(e) => setForm({ ...form, move_in_date: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Auszugsdatum (optional)</Label>
                <Input type="date" value={form.move_out_date} onChange={(e) => setForm({ ...form, move_out_date: e.target.value })} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Monatsmiete (CHF)</Label>
                <Input type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Nebenkosten (CHF)</Label>
                <Input type="number" value={form.utilities} onChange={(e) => setForm({ ...form, utilities: e.target.value })} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Internet (CHF)</Label>
                <Input type="number" value={form.internet} onChange={(e) => setForm({ ...form, internet: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Strom (CHF)</Label>
                <Input type="number" value={form.electricity} onChange={(e) => setForm({ ...form, electricity: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Reinigung (CHF)</Label>
                <Input type="number" value={form.cleaning} onChange={(e) => setForm({ ...form, cleaning: e.target.value })} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Parkplatz (CHF)</Label>
                <Input type="number" value={form.parking} onChange={(e) => setForm({ ...form, parking: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Kaution (CHF)</Label>
                <Input type="number" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <Label>Vertragsstatus</Label>
                <Select value={form.lease_status} onValueChange={(v) => setForm({ ...form, lease_status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="upcoming">Bevorstehend</SelectItem>
                    <SelectItem value="ended">Beendet</SelectItem>
                    <SelectItem value="terminated">Gekündigt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.tenant_email || !form.property_id || saveMutation.isPending}
              className="w-full bg-slate-900 hover:bg-slate-800"
            >
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
                <TableHead>Mieter</TableHead>
                <TableHead>Unterkunft</TableHead>
                <TableHead>Einzug</TableHead>
                <TableHead>Miete</TableHead>
                <TableHead>Kaution</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(lease => {
                const property = properties.find(p => p.id === lease.property_id);
                return (
                  <TableRow key={lease.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{lease.tenant_name || lease.tenant_email}</div>
                      {lease.room_name && <div className="text-xs text-slate-500">{lease.room_name}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{property?.title || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {lease.move_in_date ? format(new Date(lease.move_in_date), "d.MM.yyyy", { locale: de }) : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      CHF {lease.monthly_rent?.toLocaleString("de-CH")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={lease.deposit_status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={lease.lease_status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-blue-500 hover:text-blue-700"
                          onClick={() => generateContractMutation.mutate(lease.id)}
                          disabled={generateContractMutation.isPending}
                          title="Mietvertrag generieren"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(lease)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-400 hover:text-red-600"
                          onClick={() => deleteMutation.mutate(lease.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}