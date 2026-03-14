import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Wrench, CreditCard, Info, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const categoryIcons = {
  info: Info,
  maintenance: Wrench,
  payment_reminder: CreditCard,
  house_info: Info,
  urgent: AlertTriangle,
};

const priorityColors = {
  high: "border-l-red-500",
  normal: "border-l-amber-400",
  low: "border-l-slate-300",
};

export default function AnnouncementCard({ announcement }) {
  const Icon = categoryIcons[announcement.category] || Info;

  return (
    <Card className={`p-4 border-0 shadow-sm border-l-4 ${priorityColors[announcement.priority] || priorityColors.normal}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-slate-900 truncate">{announcement.title}</h4>
            {announcement.priority === "high" && (
              <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px]">Wichtig</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 line-clamp-2">{announcement.content}</p>
          <p className="text-[10px] text-slate-400 mt-2">
            {format(new Date(announcement.created_date), "d. MMM yyyy", { locale: de })}
          </p>
        </div>
      </div>
    </Card>
  );
}