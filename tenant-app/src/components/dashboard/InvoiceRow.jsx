import React from "react";
import StatusBadge from "../shared/StatusBadge";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function InvoiceRow({ invoice }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {invoice.description || `Rechnung ${invoice.invoice_number || ""}`}
        </p>
        <p className="text-xs text-slate-500">
          Fällig: {invoice.due_date ? format(new Date(invoice.due_date), "d. MMM yyyy", { locale: de }) : "—"}
        </p>
      </div>
      <div className="flex items-center gap-3 ml-4">
        <span className="text-sm font-semibold text-slate-900">
          CHF {invoice.amount?.toLocaleString("de-CH", { minimumFractionDigits: 2 })}
        </span>
        <StatusBadge status={invoice.status} />
      </div>
    </div>
  );
}