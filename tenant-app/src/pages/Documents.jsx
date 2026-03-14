import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, File, FileImage, Inbox } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

const categoryLabels = {
  lease_contract: "Mietvertrag",
  handover_protocol: "Übergabeprotokoll",
  house_rules: "Hausordnung",
  invoice: "Rechnung",
  receipt: "Quittung",
  other: "Sonstiges",
};

const categoryColors = {
  lease_contract: "bg-blue-50 text-blue-700 border-blue-200",
  handover_protocol: "bg-purple-50 text-purple-700 border-purple-200",
  house_rules: "bg-amber-50 text-amber-700 border-amber-200",
  invoice: "bg-emerald-50 text-emerald-700 border-emerald-200",
  receipt: "bg-slate-100 text-slate-700 border-slate-200",
  other: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function Documents() {
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["my-documents", user?.email],
    queryFn: async () => {
      const [personal, general] = await Promise.all([
        base44.entities.Document.filter({ tenant_email: user.email }),
        base44.entities.Document.filter({ tenant_email: "" }),
      ]);
      return [...personal, ...general];
    },
    enabled: !!user?.email,
  });

  const categories = ["all", ...Object.keys(categoryLabels)];
  const filtered = filter === "all" ? documents : documents.filter(d => d.category === filter);

  return (
    <div className="space-y-6">
      <PageHeader title="Dokumente" subtitle="Ihre Verträge, Quittungen und wichtige Unterlagen" />

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filter === cat
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {cat === "all" ? "Alle" : categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* Documents List */}
      {filtered.length === 0 ? (
        <EmptyState icon={Inbox} title="Keine Dokumente" description="Noch keine Dokumente in dieser Kategorie vorhanden." />
      ) : (
        <div className="grid gap-3">
          {filtered.map(doc => (
            <Card key={doc.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900 truncate">{doc.title}</h4>
                  {doc.description && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{doc.description}</p>
                  )}
                  <Badge variant="outline" className={`mt-1.5 text-[10px] ${categoryColors[doc.category] || categoryColors.other}`}>
                    {categoryLabels[doc.category] || doc.category}
                  </Badge>
                </div>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="shrink-0">
                    <Download className="w-4 h-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}