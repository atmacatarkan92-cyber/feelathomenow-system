import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Droplets, Zap, Key, Clock, Flame, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

const categoryIcons = {
  water_damage: Droplets,
  power_outage: Zap,
  key_loss: Key,
  after_hours: Clock,
  fire: Flame,
  general: AlertTriangle,
};

const categoryColors = {
  water_damage: "bg-blue-100 text-blue-600",
  power_outage: "bg-amber-100 text-amber-600",
  key_loss: "bg-purple-100 text-purple-600",
  after_hours: "bg-slate-200 text-slate-600",
  fire: "bg-red-100 text-red-600",
  general: "bg-orange-100 text-orange-600",
};

export default function Emergency() {
  const { data: emergencyInfos = [] } = useQuery({
    queryKey: ["emergency-infos"],
    queryFn: () => base44.entities.EmergencyInfo.list("sort_order"),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Notfall" subtitle="Wichtige Nummern und Anweisungen für Notfälle" />

      {/* Emergency Banner */}
      <Card className="border-0 shadow-sm bg-red-50 border-l-4 border-l-red-500">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Phone className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-red-900">Allgemeine Notfallnummern Schweiz</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Polizei", number: "117" },
              { label: "Feuerwehr", number: "118" },
              { label: "Sanität", number: "144" },
              { label: "Vergiftung", number: "145" },
            ].map(n => (
              <a key={n.number} href={`tel:${n.number}`} className="flex items-center gap-2 p-3 bg-white rounded-xl hover:shadow-sm transition-shadow">
                <Phone className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-xs text-slate-500">{n.label}</p>
                  <p className="font-bold text-red-700">{n.number}</p>
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Info Cards */}
      <div className="space-y-4">
        {emergencyInfos.map(info => {
          const Icon = categoryIcons[info.category] || AlertTriangle;
          const color = categoryColors[info.category] || categoryColors.general;
          return (
            <Card key={info.id} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{info.title}</h3>
                </div>
                <div className="pl-[52px]">
                  <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{info.instructions}</div>
                  {info.emergency_numbers?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {info.emergency_numbers.map((n, i) => (
                        <a key={i} href={`tel:${n.number}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors">
                          <Phone className="w-3 h-3" />
                          {n.label}: {n.number}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}