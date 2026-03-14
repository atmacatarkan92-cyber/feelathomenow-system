import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

const conditionLabels = {
  excellent: "Ausgezeichnet",
  good: "Gut",
  acceptable: "Akzeptabel",
  damaged: "Beschädigt",
  missing: "Fehlend",
};

const conditionColors = {
  excellent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  good: "bg-green-50 text-green-700 border-green-200",
  acceptable: "bg-yellow-50 text-yellow-700 border-yellow-200",
  damaged: "bg-orange-50 text-orange-700 border-orange-200",
  missing: "bg-red-50 text-red-700 border-red-200",
};

export default function HandoverProtocols() {
  const [user, setUser] = useState(null);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [tenantNotes, setTenantNotes] = useState("");
  const [tenantPhotos, setTenantPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: protocols = [] } = useQuery({
    queryKey: ["my-handover-protocols", user?.email],
    queryFn: () => base44.entities.HandoverProtocol.filter({ tenant_email: user.email }, "-created_date"),
    enabled: !!user?.email,
  });

  const signMutation = useMutation({
    mutationFn: (data) => base44.entities.HandoverProtocol.update(data.id, {
      tenant_signature_confirmed: true,
      tenant_signature_date: new Date().toISOString(),
      tenant_notes: data.notes,
      tenant_photos: data.photos,
      status: "completed",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-handover-protocols"] });
      setSelectedProtocol(null);
      setTenantNotes("");
      setTenantPhotos([]);
      toast.success("Übergabeprotokoll erfolgreich bestätigt");
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
    setTenantPhotos(prev => [...prev, ...urls]);
    setUploading(false);
  };

  const handleSign = () => {
    if (!selectedProtocol) return;
    signMutation.mutate({
      id: selectedProtocol.id,
      notes: tenantNotes,
      photos: tenantPhotos,
    });
  };

  const openProtocol = (protocol) => {
    setSelectedProtocol(protocol);
    setTenantNotes(protocol.tenant_notes || "");
    setTenantPhotos(protocol.tenant_photos || []);
  };

  const pendingProtocols = protocols.filter(p => p.status === "pending_tenant_signature");
  const completedProtocols = protocols.filter(p => p.status === "completed");

  return (
    <div className="space-y-6">
      <PageHeader title="Übergabeprotokolle" subtitle="Check-in und Check-out Dokumentation" />

      {/* Pending Protocols */}
      {pendingProtocols.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Wartet auf Ihre Bestätigung
          </h2>
          <div className="space-y-3">
            {pendingProtocols.map(protocol => (
              <Card key={protocol.id} className="border-0 shadow-sm border-l-4 border-l-amber-400">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">
                      {protocol.protocol_type === "check_in" ? "Check-in Protokoll" : "Check-out Protokoll"}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Erstellt am {format(new Date(protocol.created_date), "d. MMMM yyyy", { locale: de })}
                    </p>
                    <Badge variant="outline" className="mt-2 text-xs bg-amber-50 text-amber-700 border-amber-200">
                      Bitte bestätigen
                    </Badge>
                  </div>
                  <Button onClick={() => openProtocol(protocol)} className="bg-slate-900 hover:bg-slate-800">
                    Protokoll prüfen & bestätigen
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Protocols */}
      {completedProtocols.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Abgeschlossene Protokolle</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {completedProtocols.map(protocol => (
              <Card key={protocol.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openProtocol(protocol)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-slate-900 text-sm">
                      {protocol.protocol_type === "check_in" ? "Check-in" : "Check-out"}
                    </h4>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" />Bestätigt
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    {protocol.inspection_date ? format(new Date(protocol.inspection_date), "d. MMMM yyyy", { locale: de }) : "—"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {protocols.length === 0 && (
        <EmptyState icon={ClipboardCheck} title="Keine Übergabeprotokolle" description="Noch keine Übergabeprotokolle vorhanden." />
      )}

      {/* View/Sign Dialog */}
      <Dialog open={!!selectedProtocol} onOpenChange={() => setSelectedProtocol(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedProtocol && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedProtocol.protocol_type === "check_in" ? "Check-in Protokoll" : "Check-out Protokoll"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Inspektionsdatum</p>
                      <p className="font-medium">
                        {selectedProtocol.inspection_date ? format(new Date(selectedProtocol.inspection_date), "d. MMMM yyyy", { locale: de }) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Erstellt von</p>
                      <p className="font-medium">{selectedProtocol.admin_signature || "Admin"}</p>
                    </div>
                  </div>
                </div>

                {/* Checklist Items */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Zustandsprüfung</h4>
                  {selectedProtocol.checklist_items?.map((item, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-medium">{item.category} - {item.item}</p>
                        <Badge variant="outline" className={`text-xs ${conditionColors[item.condition]}`}>
                          {conditionLabels[item.condition]}
                        </Badge>
                      </div>
                      {item.notes && <p className="text-xs text-slate-600 mt-1">Notiz: {item.notes}</p>}
                      {item.photos?.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {item.photos.map((url, pi) => (
                            <img key={pi} src={url} alt="" className="w-16 h-16 rounded object-cover" />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {selectedProtocol.general_notes && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Allgemeine Notizen</p>
                    <p className="text-sm text-blue-800">{selectedProtocol.general_notes}</p>
                  </div>
                )}

                {/* Tenant Signature Section */}
                {!selectedProtocol.tenant_signature_confirmed && selectedProtocol.status === "pending_tenant_signature" && (
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-semibold text-sm">Ihre Bestätigung</h4>
                    <div>
                      <Label>Anmerkungen (optional)</Label>
                      <Textarea
                        value={tenantNotes}
                        onChange={(e) => setTenantNotes(e.target.value)}
                        placeholder="Fügen Sie hier eigene Anmerkungen hinzu, falls Sie Unstimmigkeiten feststellen..."
                        className="mt-1 h-20"
                      />
                    </div>
                    <div>
                      <Label>Fotos hochladen (optional, bei Unstimmigkeiten)</Label>
                      <label className="flex items-center justify-center gap-2 mt-1 p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-slate-300">
                        <input type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoUpload} />
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-500">{uploading ? "Wird hochgeladen..." : "Fotos auswählen"}</span>
                      </label>
                      {tenantPhotos.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {tenantPhotos.map((url, i) => (
                            <img key={i} src={url} alt="" className="w-20 h-20 rounded-lg object-cover" />
                          ))}
                        </div>
                      )}
                    </div>
                    <Button onClick={handleSign} disabled={signMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {signMutation.isPending ? "Wird bestätigt..." : "Protokoll bestätigen"}
                    </Button>
                    <p className="text-xs text-slate-500 text-center">
                      Mit Ihrer Bestätigung akzeptieren Sie die Angaben im Übergabeprotokoll
                    </p>
                  </div>
                )}

                {/* Already Signed */}
                {selectedProtocol.tenant_signature_confirmed && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <p className="font-semibold text-emerald-800">Von Ihnen bestätigt</p>
                    </div>
                    <p className="text-xs text-emerald-700">
                      {selectedProtocol.tenant_signature_date
                        ? format(new Date(selectedProtocol.tenant_signature_date), "d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })
                        : ""}
                    </p>
                    {selectedProtocol.tenant_notes && (
                      <div className="mt-3 pt-3 border-t border-emerald-200">
                        <p className="text-xs font-semibold text-emerald-800">Ihre Anmerkungen:</p>
                        <p className="text-sm text-emerald-700 mt-1">{selectedProtocol.tenant_notes}</p>
                      </div>
                    )}
                    {selectedProtocol.tenant_photos?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-emerald-200">
                        <p className="text-xs font-semibold text-emerald-800 mb-2">Ihre Fotos:</p>
                        <div className="flex gap-2 flex-wrap">
                          {selectedProtocol.tenant_photos.map((url, i) => (
                            <img key={i} src={url} alt="" className="w-20 h-20 rounded-lg object-cover" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}