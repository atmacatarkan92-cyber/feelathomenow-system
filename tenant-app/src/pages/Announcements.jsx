import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Wrench, CreditCard, Info, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

const categoryConfig = {
  info: { label: "Information", icon: Info, color: "bg-blue-50 text-blue-700" },
  maintenance: { label: "Wartung", icon: Wrench, color: "bg-amber-50 text-amber-700" },
  payment_reminder: { label: "Zahlungserinnerung", icon: CreditCard, color: "bg-emerald-50 text-emerald-700" },
  house_info: { label: "Hausinformation", icon: Info, color: "bg-purple-50 text-purple-700" },
  urgent: { label: "Dringend", icon: AlertTriangle, color: "bg-red-50 text-red-700" },
};

export default function Announcements() {
  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements-all"],
    queryFn: () => base44.entities.Announcement.filter({ published: true }, "-created_date"),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Mitteilungen" subtitle="Neuigkeiten und Informationen der Verwaltung" />

      {announcements.length === 0 ? (
        <EmptyState icon={Bell} title="Keine Mitteilungen" description="Aktuell keine neuen Mitteilungen." />
      ) : (
        <div className="space-y-4">
          {announcements.map(a => {
            const config = categoryConfig[a.category] || categoryConfig.info;
            const Icon = config.icon;
            return (
              <Card key={a.id} className={`border-0 shadow-sm ${a.priority === "high" ? "border-l-4 border-l-red-500" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl ${config.color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">{a.title}</h3>
                        {a.priority === "high" && (
                          <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px]">Wichtig</Badge>
                        )}
                      </div>
                      <Badge variant="outline" className={`mb-2 text-[10px] ${config.color}`}>
                        {config.label}
                      </Badge>
                      <p className="text-sm text-slate-600 whitespace-pre-line">{a.content}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                        <span>{format(new Date(a.created_date), "d. MMMM yyyy", { locale: de })}</span>
                        {a.valid_until && (
                          <span>Gültig bis: {format(new Date(a.valid_until), "d. MMM yyyy", { locale: de })}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}