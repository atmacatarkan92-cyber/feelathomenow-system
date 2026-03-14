import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function QuickStats({ stats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <Card key={i} className="p-5 border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
            </div>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bgColor)}>
              <stat.icon className={cn("w-5 h-5", stat.iconColor)} />
            </div>
          </div>
          {stat.sub && <p className="text-xs text-slate-500 mt-2">{stat.sub}</p>}
        </Card>
      ))}
    </div>
  );
}