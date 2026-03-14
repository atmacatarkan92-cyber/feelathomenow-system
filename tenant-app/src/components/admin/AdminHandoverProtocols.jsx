import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Eye, FileText, Upload, Trash2, Send } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import StatusBadge from "../shared/StatusBadge";

const defaultChecklist = [
  { category: "Küche", items: ["Kühlschrank", "Herd", "Spüle", "Schränke", "Arbeitsplatte"] },
  { category: "Badezimmer", items: ["WC", "Dusche/Badewanne", "Waschbecken", "Spiegel", "Fliesen"] },
  { category: "Wohnzimmer", items: ["Wände", "Boden", "Fenster", "Türen", "Heizkörper"] },
  { category: "Schlafzimmer", items: ["Wände", "Boden", "Fenster", "Schrank", "Bett (falls möbliert)"] },
  { category: "Allgemein", items: ["Eingangstür", "Schlüssel", "Briefkasten", "Keller/Estrich", "Balkon/Terrasse"] },
];

export default function AdminHandoverProtocols() {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    lease_id: "", protocol_type: "check_in", inspection_date: "", checklist_items: [], general_notes: ""
  });
  const queryClient = useQueryClient();

  const { data: protocols = [] } = useQuery({
    queryKey: ["admin-handover-protocols"],
    queryFn: () => base44.entities.HandoverProtocol.list("-created_date"),
  });

  const { data: leases = [] } = useQuery({
    queryKey: ["admin-hp-leases"],
    queryFn: () => base44.entities.Lease.list(),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["admin-hp-properties"],
    queryFn: () => base44.entities.Property.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const lease = leases.find(l => l.id === data.lease_id);
      const payload = {
        ...data,
        tenant_email: lease?.tenant_email || "",
        property_id: lease?.property_id || "",
      };
      return editItem
        ? base44.entities.HandoverProtocol.update(editItem.id, payload)
        : base44.entities.HandoverProtocol.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-handover-protocols"] });
      setShowForm(false);
      setEditItem(null);
    },
  });

  const sendToTenantMutation = useMutation({
    mutationFn: async (id) => {
      const user = await base44.auth.me();
      return base44.entities.HandoverProtocol.update(id, {
        status: "pending_tenant_signature",
        admin_signature: user.full_name || user.email,
        admin_signature_date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-handover-protocols"] });
      toast.success("Protokoll an Mieter gesendet zur Bestätigung");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.HandoverProtocol.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-handover-protocols"] }),
  });

  const initializeChecklist = () => {
    const items = [];
    defaultChecklist.forEach(cat => {
      cat.items.forEach(item => {
        items.push({ category: cat.category, item, condition: "good", notes: "", photos: [] });
      });
    });
    setForm(prev => ({ ...prev, checklist_items: items }));
  };

  const openNew = () => {
    setEditItem(null);
    setForm({ lease_id: "", protocol_type: "check_in", inspection_date: "", checklist_items: [], general_notes: "" });
    setShowForm(true);
  };

  const openEdit = (protocol) => {
    setEditItem(protocol);
    setForm({
      lease_id: protocol.lease_id,
      protocol_type: protocol.protocol_type,
      inspection_date: protocol.inspection_date || "",
      checklist_items: protocol.checklist_items || [],
      general_notes: protocol.general_notes || "",
    });
    setShowForm(true);
  };

  const updateChecklistItem = (index, field, value) => {
    const updated = [...form.checklist_items];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, checklist_items: updated });
  };

  const handlePhotoUpload = async (index, e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    const updated = [...form.checklist_items];
    updated[index].photos = [...(updated[index].photos || []), ...urls];
    setForm({ ...form, checklist_items: updated });
  };

  const filtered = protocols.filter(p => {
    const lease = leases.find(l => l.id === p.lease_id);
    return (lease?.tenant_email || "").toLowerCase().includes(search.toLowerCase()) ||
           (lease?.tenant_name || "").toLowerCase().includes(search.toLowerCase());
  });

  const statusLabels = {
    draft: "Entwurf",
    pending_tenant_signature: "Wartet auf Mieter",
    completed: "Abgeschlossen",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openNew} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />Neues Protokoll
        </Button>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? "Protokoll bearbeiten" : "Neues Übergabeprotokoll"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mietvertrag</Label>
                <Select value={form.lease_id} onValueChange={(v) => setForm({ ...form, lease_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Wählen" /></SelectTrigger>
                  <SelectContent>
                    {leases.map(l => {
                      const prop = properties.find(p => p.id === l.property_id);
                      return (
                        <SelectItem key={l.id} value={l.id}>
                          {l.tenant_name || l.tenant_email} - {prop?.title}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Typ</Label>
                <Select value={form.protocol_type} onValueChange={(v) => setForm({ ...form, protocol_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check_in">Check-in</SelectItem>
                    <SelectItem value="check_out">Check-out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Inspektionsdatum</Label>
              <Input type="date" value={form.inspection_date} onChange={(e) => setForm({ ...form, inspection_date: e.target.value })} className="mt-1" />
            </div>

            {form.checklist_items.length === 0 && (
              <Button onClick={initializeChecklist} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />Standard-Checkliste laden
              </Button>
            )}

            {form.checklist_items.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Checkliste</h4>
                {defaultChecklist.map((cat, catIdx) => {
                  const categoryItems = form.checklist_items.filter(item => item.category === cat.category);
                  if (categoryItems.length === 0) return null;
                  return (
                    <div key={catIdx} className="border rounded-xl p-3">
                      <h5 className="font-medium text-sm mb-2">{cat.category}</h5>
                      <div className="space-y-2">
                        {categoryItems.map((checkItem, itemIdx) => {
                          const globalIndex = form.checklist_items.findIndex(
                            item => item.category === checkItem.category && item.item === checkItem.item
                          );
                          return (
                            <div key={itemIdx} className="flex items-start gap-3 p-2 bg-slate-50 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{checkItem.item}</p>
                                <div className="flex gap-2 mt-1">
                                  <Select
                                    value={checkItem.condition}
                                    onValueChange={(v) => updateChecklistItem(globalIndex, "condition", v)}
                                  >
                                    <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="excellent">Ausgezeichnet</SelectItem>
                                      <SelectItem value="good">Gut</SelectItem>
                                      <SelectItem value="acceptable">Akzeptabel</SelectItem>
                                      <SelectItem value="damaged">Beschädigt</SelectItem>
                                      <SelectItem value="missing">Fehlend</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    placeholder="Notiz..."
                                    value={checkItem.notes || ""}
                                    onChange={(e) => updateChecklistItem(globalIndex, "notes", e.target.value)}
                                    className="h-7 text-xs flex-1"
                                  />
                                  <label className="cursor-pointer">
                                    <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handlePhotoUpload(globalIndex, e)} />
                                    <div className="h-7 px-2 flex items-center gap-1 border rounded-md hover:bg-slate-100 text-xs">
                                      <Upload className="w-3 h-3" />{checkItem.photos?.length || 0}
                                    </div>
                                  </label>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <Label>Allgemeine Notizen</Label>
              <Textarea value={form.general_notes} onChange={(e) => setForm({ ...form, general_notes: e.target.value })} className="mt-1 h-20" />
            </div>

            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.lease_id || saveMutation.isPending} className="w-full bg-slate-900 hover:bg-slate-800">
              {saveMutation.isPending ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewItem && (
            <>
              <DialogHeader><DialogTitle>Übergabeprotokoll - {viewItem.protocol_type === "check_in" ? "Check-in" : "Check-out"}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Mieter</p>
                    <p className="font-medium">{leases.find(l => l.id === viewItem.lease_id)?.tenant_name || viewItem.tenant_email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Datum</p>
                    <p className="font-medium">{viewItem.inspection_date ? format(new Date(viewItem.inspection_date), "d. MMM yyyy", { locale: de }) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <Badge>{statusLabels[viewItem.status]}</Badge>
                  </div>
                </div>

                {viewItem.checklist_items?.map((item, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-medium">{item.category} - {item.item}</p>
                      <Badge variant="outline" className="text-xs">{item.condition}</Badge>
                    </div>
                    {item.notes && <p className="text-xs text-slate-600 mt-1">{item.notes}</p>}
                    {item.photos?.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {item.photos.map((url, pi) => (
                          <img key={pi} src={url} alt="" className="w-16 h-16 rounded object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {viewItem.tenant_signature_confirmed && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-sm font-semibold text-green-800">✓ Vom Mieter bestätigt</p>
                    <p className="text-xs text-green-600 mt-1">{viewItem.tenant_signature_date ? format(new Date(viewItem.tenant_signature_date), "d. MMM yyyy HH:mm", { locale: de }) : ""}</p>
                    {viewItem.tenant_notes && <p className="text-xs text-slate-600 mt-2">Notiz: {viewItem.tenant_notes}</p>}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Mieter</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(protocol => {
                const lease = leases.find(l => l.id === protocol.lease_id);
                return (
                  <TableRow key={protocol.id}>
                    <TableCell className="text-sm font-medium">{lease?.tenant_name || protocol.tenant_email}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{protocol.protocol_type === "check_in" ? "Check-in" : "Check-out"}</Badge></TableCell>
                    <TableCell className="text-sm">{protocol.inspection_date ? format(new Date(protocol.inspection_date), "d.MM.yyyy") : "—"}</TableCell>
                    <TableCell><Badge className="text-xs">{statusLabels[protocol.status]}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewItem(protocol)} title="Ansehen">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {protocol.status === "draft" && (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(protocol)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-blue-500"
                              onClick={() => sendToTenantMutation.mutate(protocol.id)}
                              title="An Mieter senden"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => deleteMutation.mutate(protocol.id)}>
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