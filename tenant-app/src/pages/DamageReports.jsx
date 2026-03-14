import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Upload, AlertTriangle, MessageSquare, Image } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";

const categoryLabels = {
  electrical: "Elektrik",
  water: "Wasser",
  heating: "Heizung",
  furniture: "Möbel",
  internet: "Internet",
  cleaning: "Reinigung",
  other: "Sonstiges",
};

export default function DamageReports() {
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", category: "other", urgency: "medium", photos: [] });
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: leases = [] } = useQuery({
    queryKey: ["my-leases-dmg", user?.email],
    queryFn: () => base44.entities.Lease.filter({ tenant_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["my-damage-reports", user?.email],
    queryFn: () => base44.entities.DamageReport.filter({ tenant_email: user.email }, "-created_date"),
    enabled: !!user?.email,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DamageReport.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-damage-reports"] });
      setShowForm(false);
      setForm({ title: "", description: "", category: "other", urgency: "medium", photos: [] });
    },
  });

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    setForm(prev => ({ ...prev, photos: [...prev.photos, ...urls] }));
    setUploading(false);
  };

  const handleSubmit = () => {
    const activeLease = leases.find(l => l.lease_status === "active") || leases[0];
    createMutation.mutate({
      ...form,
      tenant_email: user.email,
      property_id: activeLease?.property_id || "",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schäden & Support"
        subtitle="Schäden melden und Status verfolgen"
        action={
          <Button onClick={() => setShowForm(true)} className="bg-slate-900 hover:bg-slate-800">
            <Plus className="w-4 h-4 mr-2" />
            Schaden melden
          </Button>
        }
      />

      {/* New Report Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Neuen Schaden melden</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Titel</Label>
              <Input
                placeholder="z.B. Wasserhahn tropft"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kategorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dringlichkeit</Label>
                <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="emergency">Notfall</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea
                placeholder="Beschreiben Sie den Schaden möglichst genau..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="h-24"
              />
            </div>
            <div>
              <Label>Fotos</Label>
              <label className="flex items-center justify-center gap-2 mt-1 p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-slate-300 transition-colors">
                <input type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoUpload} />
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">{uploading ? "Wird hochgeladen..." : "Fotos auswählen"}</span>
              </label>
              {form.photos.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {form.photos.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </div>
            <Button onClick={handleSubmit} disabled={!form.title || !form.description || createMutation.isPending} className="w-full bg-slate-900 hover:bg-slate-800">
              {createMutation.isPending ? "Wird gesendet..." : "Meldung absenden"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedReport && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedReport.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="flex gap-2">
                  <StatusBadge status={selectedReport.status} />
                  <StatusBadge status={selectedReport.urgency} />
                </div>
                <p className="text-sm text-slate-600">{selectedReport.description}</p>
                {selectedReport.photos?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {selectedReport.photos.map((url, i) => (
                      <img key={i} src={url} alt="" className="rounded-xl object-cover aspect-square" />
                    ))}
                  </div>
                )}
                {selectedReport.communication_log?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> Kommunikation
                    </h4>
                    <div className="space-y-2">
                      {selectedReport.communication_log.map((log, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-xl">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>{log.author}</span>
                            <span>{log.date}</span>
                          </div>
                          <p className="text-sm text-slate-700">{log.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reports List */}
      {reports.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Keine Meldungen" description="Sie haben noch keine Schadensmeldung erstellt." />
      ) : (
        <div className="space-y-3">
          {reports.map(report => (
            <Card
              key={report.id}
              className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedReport(report)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900">{report.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{report.description}</p>
                    <div className="flex gap-2 mt-2">
                      <StatusBadge status={report.status} />
                      <StatusBadge status={report.urgency} />
                      <span className="text-[10px] text-slate-400 self-center">
                        {categoryLabels[report.category] || report.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {report.photos?.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Image className="w-3 h-3" />{report.photos.length}
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {format(new Date(report.created_date), "d. MMM", { locale: de })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}