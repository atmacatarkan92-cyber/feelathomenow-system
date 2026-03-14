import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function AdminAnnouncements() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "info", priority: "normal" });
  const queryClient = useQueryClient();

  const { data: announcements = [] } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: () => base44.entities.Announcement.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Announcement.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      setShowForm(false);
      setForm({ title: "", content: "", category: "info", priority: "normal" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Announcement.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(true)} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />Mitteilung erstellen
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Mitteilung</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="mt-1" /></div>
            <div><Label>Inhalt</Label><Textarea value={form.content} onChange={(e) => setForm({...form, content: e.target.value})} className="mt-1 h-24" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Kategorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Information</SelectItem>
                    <SelectItem value="maintenance">Wartung</SelectItem>
                    <SelectItem value="payment_reminder">Zahlungserinnerung</SelectItem>
                    <SelectItem value="house_info">Hausinformation</SelectItem>
                    <SelectItem value="urgent">Dringend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Priorität</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({...form, priority: v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.title || !form.content} className="w-full bg-slate-900 hover:bg-slate-800">
              Veröffentlichen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {announcements.map(a => (
          <Card key={a.id} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm text-slate-900">{a.title}</h4>
                  <Badge variant="outline" className="text-[10px]">{a.category}</Badge>
                  {a.priority === "high" && <Badge className="bg-red-50 text-red-600 text-[10px]">Wichtig</Badge>}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{a.content}</p>
                <p className="text-[10px] text-slate-400 mt-1">{format(new Date(a.created_date), "d. MMM yyyy", { locale: de })}</p>
              </div>
              <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-600 shrink-0" onClick={() => deleteMutation.mutate(a.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}