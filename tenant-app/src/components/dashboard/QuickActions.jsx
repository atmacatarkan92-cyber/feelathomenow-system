import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FileText, AlertTriangle, Users, Phone } from "lucide-react";

const actions = [
  { label: "Dokumente", icon: FileText, page: "Documents", color: "bg-blue-50 text-blue-600" },
  { label: "Schaden melden", icon: AlertTriangle, page: "DamageReports", color: "bg-orange-50 text-orange-600" },
  { label: "Kontakte", icon: Users, page: "Contacts", color: "bg-emerald-50 text-emerald-600" },
  { label: "Notfall", icon: Phone, page: "Emergency", color: "bg-red-50 text-red-600" },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map((action) => (
        <Link
          key={action.page}
          to={createPageUrl(action.page)}
          className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 hover:border-orange-400 hover:shadow-md hover:shadow-orange-100 transition-all group"
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${action.color} group-hover:scale-105 transition-transform`}>
            <action.icon className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-slate-700">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}