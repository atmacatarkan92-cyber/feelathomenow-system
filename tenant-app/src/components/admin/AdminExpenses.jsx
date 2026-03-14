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
import { Plus, Search, Edit2, Trash2, Upload } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

export default function AdminExpenses() {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    property_id: "", category: "other", description: "", amount: "", date: "", recurring: false, notes: ""
  });
  const queryClient = useQueryClient();

  const { data: expenses = [] } = useQuery({
    queryKey: ["admin-expenses"],
    queryFn: () => base44.entities.Expense.list("-date"),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["admin-expense-properties"],
    queryFn: () => base44.entities.Property.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const now = new Date(data.date);
      const payload = {
        ...data,
        amount: parseFloat(data.amount) || 0,
        period_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      };
      return editItem ? base44.entities.Expense.update(editItem.id, payload) : base44.entities.Expense.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-expenses"] });
      setShowForm(false);
      setEditItem(null);
      setForm({ property_id: "", category: "other", description: "", amount: "", date: "", recurring: false, notes: "" });
      toast.success("Ausgabe gespeichert");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-expenses"] }),
  });

  const openEdit = (expense) => {
    setEditItem(expense);
    setForm({
      property_id: expense.property_id || "",
      category: expense.category || "other",
      description: expense.description || "",
      amount: expense.amount?.toString() || "",
      date: expense.date || "",
      recurring: expense.recurring || false,
      notes: expense.notes || "",
    });
    setShowForm(true);
  };

  const filtered = expenses.filter(e =>
    (e.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const categoryLabels = {
    cleaning: "Reinigung",
    internet: "Internet",
    electricity: "Strom",
    furniture: "Möbel",
    repair: "Reparaturen",
    maintenance: "Wartung",
    other: "Sonstiges",
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="text-sm font-semibold text-slate-700">
          Total: <span className="text-red-600">CHF {totalExpenses.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</span>
        </div>
        <Button onClick={() => { setEditItem(null); setShowForm(true); }} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />Ausgabe erfassen
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "Ausgabe bearbeiten" : "Neue Ausgabe"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Unterkunft (optional)</Label>
              <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Alle / Keine Zuordnung" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Keine Zuordnung</SelectItem>
                  {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kategorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleaning">Reinigung</SelectItem>
                    <SelectItem value="internet">Internet</SelectItem>
                    <SelectItem value="electricity">Strom</SelectItem>
                    <SelectItem value="furniture">Möbel</SelectItem>
                    <SelectItem value="repair">Reparaturen</SelectItem>
                    <SelectItem value="maintenance">Wartung</SelectItem>
                    <SelectItem value="other">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Betrag (CHF)</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Datum</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Notizen</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 h-20" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} className="w-4 h-4" />
              <span className="text-sm">Wiederkehrende Kosten (monatlich)</span>
            </label>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.amount || !form.date || saveMutation.isPending} className="w-full bg-slate-900 hover:bg-slate-800">
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
                <TableHead>Datum</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Unterkunft</TableHead>
                <TableHead>Betrag</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(expense => {
                const property = properties.find(p => p.id === expense.property_id);
                return (
                  <TableRow key={expense.id}>
                    <TableCell className="text-sm">{expense.date ? format(new Date(expense.date), "d.MM.yyyy", { locale: de }) : "—"}</TableCell>
                    <TableCell className="text-sm font-medium">{expense.description || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{categoryLabels[expense.category]}</Badge></TableCell>
                    <TableCell className="text-sm">{property?.title || "—"}</TableCell>
                    <TableCell className="text-sm font-semibold text-red-600">CHF {expense.amount?.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(expense)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => deleteMutation.mutate(expense.id)}>
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