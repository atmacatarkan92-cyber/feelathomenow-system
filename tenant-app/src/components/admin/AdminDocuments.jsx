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
import { Plus, Upload, Download, Trash2 } from "lucide-react";

const categoryLabels = {
  lease_contract: "Mietvertrag", handover_protocol: "Übergabeprotokoll",
  house_rules: "Hausordnung", invoice: "Rechnung", receipt: "Quittung", other: "Sonstiges",
};

export default function AdminDocuments() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "other", tenant_email: "", description: "", file_url: "" });
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: documents = [] } = useQuery({
    queryKey: ["admin-documents"],
    queryFn: () => base44.entities.Document.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Document.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
      setShowForm(false);
      setForm({ title: "", category: "other", tenant_email: "", description: "", file_url: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-documents"] }),
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(prev => ({ ...prev, file_url }));
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(true)} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />Dokument hochladen
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neues Dokument</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="mt-1" /></div>
            <div><Label>Kategorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Mieter E-Mail (leer = für alle)</Label><Input value={form.tenant_email} onChange={(e) => setForm({...form, tenant_email: e.target.value})} className="mt-1" placeholder="leer lassen für alle Mieter" /></div>
            <div><Label>Beschreibung</Label><Input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="mt-1" /></div>
            <div>
              <Label>Datei</Label>
              <label className="flex items-center justify-center gap-2 mt-1 p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-slate-300">
                <input type="file" className="hidden" onChange={handleFileUpload} />
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">{uploading ? "Wird hochgeladen..." : form.file_url ? "Datei gewählt ✓" : "Datei auswählen"}</span>
              </label>
            </div>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.title || !form.file_url} className="w-full bg-slate-900 hover:bg-slate-800">Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Titel</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Mieter</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium text-sm">{doc.title}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{categoryLabels[doc.category] || doc.category}</Badge></TableCell>
                  <TableCell className="text-sm text-slate-500">{doc.tenant_email || "Alle"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="icon" variant="ghost" className="h-8 w-8"><Download className="w-3.5 h-3.5" /></Button>
                      </a>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(doc.id)}>
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