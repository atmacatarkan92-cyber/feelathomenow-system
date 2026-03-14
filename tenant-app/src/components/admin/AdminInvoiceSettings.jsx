import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { toast } from "sonner";

export default function AdminInvoiceSettings() {
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ["invoice-settings"],
    queryFn: () => base44.entities.InvoiceSettings.list(),
  });

  const setting = settings[0] || {};

  const [form, setForm] = useState({
    company_name: setting.company_name || "FeelAtHomeNow",
    company_address: setting.company_address || "Musterstrasse 123",
    company_city: setting.company_city || "8000 Zürich",
    iban: setting.iban || "CH93 0076 2011 6238 5295 7",
    payment_due_days: setting.payment_due_days || 10,
    reminder_days_after_due: setting.reminder_days_after_due || 5,
    auto_generate_day_of_month: setting.auto_generate_day_of_month || 1,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (settings.length > 0) {
        return base44.entities.InvoiceSettings.update(settings[0].id, data);
      } else {
        return base44.entities.InvoiceSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-settings"] });
      toast.success("Einstellungen gespeichert");
    },
  });

  return (
    <div className="max-w-2xl">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Rechnungseinstellungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Firma</Label>
            <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Adresse</Label>
            <Input value={form.company_address} onChange={(e) => setForm({ ...form, company_address: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Stadt</Label>
            <Input value={form.company_city} onChange={(e) => setForm({ ...form, company_city: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>IBAN (für QR-Rechnung)</Label>
            <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} className="mt-1" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Zahlungsfrist (Tage)</Label>
              <Input type="number" value={form.payment_due_days} onChange={(e) => setForm({ ...form, payment_due_days: parseInt(e.target.value) })} className="mt-1" />
            </div>
            <div>
              <Label>Mahnung nach (Tage)</Label>
              <Input type="number" value={form.reminder_days_after_due} onChange={(e) => setForm({ ...form, reminder_days_after_due: parseInt(e.target.value) })} className="mt-1" />
            </div>
            <div>
              <Label>Automatisch am Tag</Label>
              <Input type="number" min="1" max="28" value={form.auto_generate_day_of_month} onChange={(e) => setForm({ ...form, auto_generate_day_of_month: parseInt(e.target.value) })} className="mt-1" />
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="bg-slate-900 hover:bg-slate-800">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}