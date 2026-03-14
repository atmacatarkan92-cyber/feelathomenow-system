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
import { Plus, Search, FileText, Download, Send, Zap } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import StatusBadge from "../shared/StatusBadge";

export default function AdminInvoices() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    tenant_email: "", invoice_number: "", description: "", amount: "", due_date: "", status: "open", payment_reference: ""
  });
  const queryClient = useQueryClient();

  const { data: invoices = [] } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: () => base44.entities.Invoice.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Invoice.create({ ...data, total_amount: parseFloat(data.amount) || 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      setShowForm(false);
      setForm({ tenant_email: "", invoice_number: "", description: "", amount: "", due_date: "", status: "open", payment_reference: "" });
    },
  });

  const generateMonthlyMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateMonthlyInvoices', {}),
    onSuccess: (response) => {
      toast.success(`${response.data.created} Rechnungen erstellt`);
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: (error) => {
      toast.error('Fehler beim Erstellen: ' + error.message);
    },
  });

  const generatePDFMutation = useMutation({
    mutationFn: (invoice_id) => base44.functions.invoke('generateInvoicePDF', { invoice_id }),
    onSuccess: () => {
      toast.success('PDF-Rechnung erstellt und per E-Mail versendet');
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: (error) => {
      toast.error('Fehler: ' + error.message);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Invoice.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-invoices"] }),
  });

  const filtered = invoices.filter(i =>
    (i.tenant_email || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button
          onClick={() => generateMonthlyMutation.mutate()}
          disabled={generateMonthlyMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Zap className="w-4 h-4 mr-2" />
          {generateMonthlyMutation.isPending ? "Läuft..." : "Monatsrechnungen generieren"}
        </Button>
        <Button onClick={() => setShowForm(true)} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />Manuell erstellen
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Rechnung</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Mieter E-Mail</Label><Input value={form.tenant_email} onChange={(e) => setForm({...form, tenant_email: e.target.value})} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Rechnungsnr.</Label><Input value={form.invoice_number} onChange={(e) => setForm({...form, invoice_number: e.target.value})} className="mt-1" /></div>
              <div><Label>Betrag (CHF)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} className="mt-1" /></div>
            </div>
            <div><Label>Beschreibung</Label><Input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fälligkeitsdatum</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({...form, due_date: e.target.value})} className="mt-1" /></div>
              <div><Label>Zahlungsreferenz</Label><Input value={form.payment_reference} onChange={(e) => setForm({...form, payment_reference: e.target.value})} className="mt-1" /></div>
            </div>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.tenant_email || !form.amount} className="w-full bg-slate-900 hover:bg-slate-800">
              Erstellen
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
                <TableHead>Periode</TableHead>
                <TableHead>Betrag</TableHead>
                <TableHead>Fällig</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="text-sm">{inv.tenant_email}</TableCell>
                  <TableCell className="text-sm">{inv.period_month || inv.invoice_number}</TableCell>
                  <TableCell className="font-medium">CHF {(inv.total_amount || inv.amount || 0).toLocaleString("de-CH", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-sm">{inv.due_date ? format(new Date(inv.due_date), "d.MM.yyyy") : "—"}</TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!inv.pdf_url && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-blue-500"
                          onClick={() => generatePDFMutation.mutate(inv.id)}
                          disabled={generatePDFMutation.isPending}
                          title="PDF generieren & versenden"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {inv.pdf_url && (
                        <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="PDF anzeigen">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      <Select value={inv.status} onValueChange={(v) => updateStatus.mutate({ id: inv.id, status: v })}>
                        <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Entwurf</SelectItem>
                          <SelectItem value="sent">Versendet</SelectItem>
                          <SelectItem value="open">Offen</SelectItem>
                          <SelectItem value="paid">Bezahlt</SelectItem>
                          <SelectItem value="overdue">Überfällig</SelectItem>
                          <SelectItem value="cancelled">Storniert</SelectItem>
                        </SelectContent>
                      </Select>
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