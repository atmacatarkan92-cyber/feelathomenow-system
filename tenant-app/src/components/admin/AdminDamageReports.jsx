import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Eye, Image } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import StatusBadge from "../shared/StatusBadge";

const categoryLabels = {
  electrical: "Elektrik", water: "Wasser", heating: "Heizung",
  furniture: "Möbel", internet: "Internet", cleaning: "Reinigung", other: "Sonstiges",
};

export default function AdminDamageReports() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const { data: reports = [] } = useQuery({
    queryKey: ["admin-damage-reports"],
    queryFn: () => base44.entities.DamageReport.list("-created_date"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DamageReport.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-damage-reports"] });
    },
  });

  const addNote = () => {
    if (!note.trim() || !selected) return;
    const log = [...(selected.communication_log || []), {
      date: new Date().toISOString(),
      author: "Admin",
      message: note,
    }];
    updateMutation.mutate({ id: selected.id, data: { communication_log: log } });
    setSelected(prev => ({ ...prev, communication_log: log }));
    setNote("");
  };

  const filtered = reports.filter(r =>
    (r.tenant_email || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.title || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.title}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="flex gap-2 flex-wrap">
                  <StatusBadge status={selected.status} />
                  <StatusBadge status={selected.urgency} />
                  <span className="text-xs text-slate-500 self-center">{categoryLabels[selected.category]}</span>
                </div>
                <p className="text-sm text-slate-600">{selected.description}</p>
                <p className="text-xs text-slate-500">Mieter: {selected.tenant_email}</p>
                {selected.photos?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {selected.photos.map((url, i) => (
                      <img key={i} src={url} alt="" className="rounded-xl object-cover aspect-square" />
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Status ändern</p>
                  <Select value={selected.status} onValueChange={(v) => {
                    updateMutation.mutate({ id: selected.id, data: { status: v } });
                    setSelected(prev => ({ ...prev, status: v }));
                  }}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="received">Eingegangen</SelectItem>
                      <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                      <SelectItem value="resolved">Erledigt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selected.communication_log?.length > 0 && (
                  <div className="space-y-2">
                    {selected.communication_log.map((log, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl text-sm">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>{log.author}</span>
                          <span>{format(new Date(log.date), "d.MM.yyyy HH:mm")}</span>
                        </div>
                        <p className="text-slate-700">{log.message}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea placeholder="Notiz hinzufügen..." value={note} onChange={(e) => setNote(e.target.value)} className="h-16" />
                  <Button onClick={addNote} className="self-end bg-slate-900 hover:bg-slate-800" disabled={!note.trim()}>Senden</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Datum</TableHead>
                <TableHead>Mieter</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Dringlichkeit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(r)}>
                  <TableCell className="text-xs">{format(new Date(r.created_date), "d.MM.yy")}</TableCell>
                  <TableCell className="text-sm">{r.tenant_email}</TableCell>
                  <TableCell className="text-sm font-medium">{r.title}</TableCell>
                  <TableCell className="text-xs">{categoryLabels[r.category] || r.category}</TableCell>
                  <TableCell><StatusBadge status={r.urgency} /></TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {r.photos?.length > 0 && <Image className="w-3.5 h-3.5 text-slate-400" />}
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
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