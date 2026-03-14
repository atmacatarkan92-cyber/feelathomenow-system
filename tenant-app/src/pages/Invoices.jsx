import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receipt, Upload, Download, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";

export default function Invoices() {
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState("all");
  const [uploadingId, setUploadingId] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["my-invoices", user?.email],
    queryFn: () => base44.entities.Invoice.filter({ tenant_email: user.email }, "-due_date"),
    enabled: !!user?.email,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ invoiceId, file }) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Invoice.update(invoiceId, { payment_confirmation_url: file_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-invoices"] });
      setUploadingId(null);
    },
  });

  const handleFileUpload = async (invoiceId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingId(invoiceId);
    uploadMutation.mutate({ invoiceId, file });
  };

  const filtered = filter === "all" ? invoices : invoices.filter(i => i.status === filter);

  const totalOpen = invoices.filter(i => i.status === "open" || i.status === "overdue")
    .reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Rechnungen & Zahlungen" subtitle="Übersicht aller Rechnungen und Zahlungen" />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Offen</p>
              <p className="text-lg font-bold text-slate-900">CHF {totalOpen.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </Card>
        <Card className="border-0 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Bezahlt</p>
              <p className="text-lg font-bold text-slate-900">{invoices.filter(i => i.status === "paid").length}</p>
            </div>
          </div>
        </Card>
        <Card className="border-0 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Überfällig</p>
              <p className="text-lg font-bold text-slate-900">{invoices.filter(i => i.status === "overdue").length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["all", "open", "paid", "overdue"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filter === f ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {f === "all" ? "Alle" : f === "open" ? "Offen" : f === "paid" ? "Bezahlt" : "Überfällig"}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      {filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="Keine Rechnungen" description="Noch keine Rechnungen vorhanden." />
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => (
            <Card key={inv.id} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      {inv.description || `Rechnung ${inv.invoice_number || ""}`}
                    </h4>
                    {inv.invoice_number && (
                      <p className="text-xs text-slate-500 mt-0.5">Nr. {inv.invoice_number}</p>
                    )}
                  </div>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Betrag</p>
                    <p className="font-semibold text-slate-900">CHF {inv.amount?.toLocaleString("de-CH", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Fällig am</p>
                    <p className="text-slate-700">{inv.due_date ? format(new Date(inv.due_date), "d. MMM yyyy", { locale: de }) : "—"}</p>
                  </div>
                  {inv.payment_reference && (
                    <div>
                      <p className="text-xs text-slate-500">Referenz</p>
                      <p className="text-slate-700 font-mono text-xs">{inv.payment_reference}</p>
                    </div>
                  )}
                  {inv.paid_date && (
                    <div>
                      <p className="text-xs text-slate-500">Bezahlt am</p>
                      <p className="text-slate-700">{format(new Date(inv.paid_date), "d. MMM yyyy", { locale: de })}</p>
                    </div>
                  )}
                </div>
                {/* PDF Download */}
                {inv.pdf_url && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <a
                      href={inv.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Rechnung als PDF herunterladen (inkl. QR-Rechnung)
                    </a>
                  </div>
                )}
                {/* PDF Download */}
                {inv.pdf_url && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <a
                      href={inv.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Rechnung als PDF herunterladen (inkl. QR-Rechnung)
                    </a>
                  </div>
                )}
                {/* Upload Payment Confirmation */}
                {inv.status !== "paid" && inv.status !== "cancelled" && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileUpload(inv.id, e)}
                      />
                      <div className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingId === inv.id ? "Wird hochgeladen..." : "Zahlungsbestätigung hochladen"}
                      </div>
                    </label>
                  </div>
                )}
                {inv.payment_confirmation_url && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <a
                      href={inv.payment_confirmation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Zahlungsbestätigung ansehen
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}