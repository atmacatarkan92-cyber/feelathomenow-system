import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Home, Receipt, ShieldAlert, Calendar, CreditCard,
  ChevronRight, MapPin, Clock
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import QuickStats from "@/components/dashboard/QuickStats";
import QuickActions from "@/components/dashboard/QuickActions";
import AnnouncementCard from "@/components/dashboard/AnnouncementCard";
import InvoiceRow from "@/components/dashboard/InvoiceRow";

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: leases = [], isLoading: leasesLoading } = useQuery({
    queryKey: ["my-leases", user?.email],
    queryFn: () => base44.entities.Lease.filter({ tenant_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["my-invoices", user?.email],
    queryFn: () => base44.entities.Invoice.filter({ tenant_email: user.email }, "-due_date", 5),
    enabled: !!user?.email,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => base44.entities.Announcement.filter({ published: true }, "-created_date", 3),
    enabled: !!user,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: () => base44.entities.Property.list(),
    enabled: !!user,
  });

  const activeLease = leases.find(l => l.lease_status === "active") || leases[0];
  const property = properties.find(p => p.id === activeLease?.property_id);
  const openInvoices = invoices.filter(i => i.status === "open" || i.status === "overdue");

  if (!user) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Monatsmiete",
      value: activeLease ? `CHF ${activeLease.monthly_rent?.toLocaleString("de-CH")}` : "—",
      icon: CreditCard,
      bgColor: "bg-gradient-to-br from-orange-500 to-orange-600",
      iconColor: "text-white",
    },
    {
      label: "Offene Rechnungen",
      value: openInvoices.length,
      icon: Receipt,
      bgColor: openInvoices.length > 0 ? "bg-amber-100" : "bg-emerald-100",
      iconColor: openInvoices.length > 0 ? "text-amber-600" : "text-emerald-600",
    },
    {
      label: "Kaution",
      value: activeLease?.deposit_amount ? `CHF ${activeLease.deposit_amount.toLocaleString("de-CH")}` : "—",
      icon: ShieldAlert,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
      sub: activeLease?.deposit_status ? undefined : undefined,
    },
    {
      label: "Vertragsdauer",
      value: activeLease?.move_in_date
        ? format(new Date(activeLease.move_in_date), "MMM yyyy", { locale: de })
        : "—",
      icon: Calendar,
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
      sub: activeLease?.move_out_date
        ? `bis ${format(new Date(activeLease.move_out_date), "MMM yyyy", { locale: de })}`
        : undefined,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Willkommen, ${user.full_name?.split(" ")[0] || "zurück"}`}
        subtitle="Ihr FeelAtHomeNow Dashboard – Alles für Ihr Zuhause"
      />

      <QuickStats stats={stats} />

      {/* Property Overview */}
      {property && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            {property.photos?.[0] && (
              <div className="sm:w-48 h-40 sm:h-auto">
                <img src={property.photos[0]} alt={property.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg">{property.title}</h3>
                  {activeLease?.room_name && (
                    <p className="text-sm text-slate-500">{activeLease.room_name}</p>
                  )}
                </div>
                {activeLease && <StatusBadge status={activeLease.lease_status} />}
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-sm text-slate-500">
                <MapPin className="w-3.5 h-3.5" />
                {property.address}{property.city ? `, ${property.city}` : ""}
              </div>
              {activeLease?.move_in_date && (
                <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  Einzug: {format(new Date(activeLease.move_in_date), "d. MMMM yyyy", { locale: de })}
                </div>
              )}
              <Link
                to={createPageUrl("MyAccommodation")}
                className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-slate-900 hover:text-slate-600 transition-colors"
              >
                Details ansehen <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Schnellzugriff</h2>
        <QuickActions />
      </div>

      {/* Bottom Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Open Invoices */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Rechnungen</CardTitle>
              <Link to={createPageUrl("Invoices")} className="text-xs text-slate-500 hover:text-slate-900 font-medium">
                Alle anzeigen →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">Keine Rechnungen vorhanden</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {invoices.slice(0, 4).map(inv => <InvoiceRow key={inv.id} invoice={inv} />)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Announcements */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Mitteilungen</CardTitle>
              <Link to={createPageUrl("Announcements")} className="text-xs text-slate-500 hover:text-slate-900 font-medium">
                Alle anzeigen →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">Keine Mitteilungen</p>
            ) : (
              announcements.map(a => <AnnouncementCard key={a.id} announcement={a} />)
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}