import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  // Invoice statuses
  open: { label: "Offen", className: "bg-amber-50 text-amber-700 border-amber-200" },
  paid: { label: "Bezahlt", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  overdue: { label: "Überfällig", className: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { label: "Storniert", className: "bg-slate-100 text-slate-500 border-slate-200" },
  // Deposit statuses
  pending: { label: "Ausstehend", className: "bg-amber-50 text-amber-700 border-amber-200" },
  partially_paid: { label: "Teilweise bezahlt", className: "bg-blue-50 text-blue-700 border-blue-200" },
  returned: { label: "Zurückerstattet", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  // Damage report statuses
  received: { label: "Eingegangen", className: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "In Bearbeitung", className: "bg-amber-50 text-amber-700 border-amber-200" },
  resolved: { label: "Erledigt", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  // Lease statuses
  active: { label: "Aktiv", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  upcoming: { label: "Bevorstehend", className: "bg-blue-50 text-blue-700 border-blue-200" },
  ended: { label: "Beendet", className: "bg-slate-100 text-slate-500 border-slate-200" },
  terminated: { label: "Gekündigt", className: "bg-red-50 text-red-700 border-red-200" },
  // Urgency
  low: { label: "Niedrig", className: "bg-slate-100 text-slate-600 border-slate-200" },
  medium: { label: "Mittel", className: "bg-amber-50 text-amber-700 border-amber-200" },
  high: { label: "Hoch", className: "bg-orange-50 text-orange-700 border-orange-200" },
  emergency: { label: "Notfall", className: "bg-red-50 text-red-700 border-red-200" },
};

export default function StatusBadge({ status, className }) {
  const config = statusConfig[status] || { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <Badge variant="outline" className={cn("font-medium text-xs border", config.className, className)}>
      {config.label}
    </Badge>
  );
}