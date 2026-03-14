import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Home, Receipt, AlertTriangle, FileText, Bell, Phone, FileSignature, ClipboardCheck, TrendingUp, MapPin, Sparkles, Calendar, DollarSign } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import AdminTenants from "@/components/admin/AdminTenants";
import AdminProperties from "@/components/admin/AdminProperties";
import AdminLeases from "@/components/admin/AdminLeases";
import AdminHandoverProtocols from "@/components/admin/AdminHandoverProtocols";
import AdminInvoices from "@/components/admin/AdminInvoices";
import AdminDamageReports from "@/components/admin/AdminDamageReports";
import AdminDocuments from "@/components/admin/AdminDocuments";
import AdminAnnouncements from "@/components/admin/AdminAnnouncements";
import AdminContacts from "@/components/admin/AdminContacts";

import AdminInvoiceSettings from "@/components/admin/AdminInvoiceSettings";
import AdminFinanceDashboard from "@/components/admin/AdminFinanceDashboard";
import AdminOccupancyMap from "@/components/admin/AdminOccupancyMap";
import AdminServiceTypes from "@/components/admin/AdminServiceTypes";
import AdminServiceCalendar from "@/components/admin/AdminServiceCalendar";
import AdminExpenses from "@/components/admin/AdminExpenses";

const tabs = [
  { value: "finance", label: "Finanzen", icon: TrendingUp },
  { value: "occupancy", label: "Belegung", icon: MapPin },
  { value: "tenants", label: "Mieter", icon: Users },
  { value: "properties", label: "Unterkünfte", icon: Home },
  { value: "leases", label: "Mietverträge", icon: FileSignature },
  { value: "handover", label: "Übergabeprotokolle", icon: ClipboardCheck },
  { value: "invoices", label: "Rechnungen", icon: Receipt },
  { value: "expenses", label: "Ausgaben", icon: DollarSign },
  { value: "services", label: "Services", icon: Sparkles },
  { value: "calendar", label: "Kalender", icon: Calendar },
  { value: "damage", label: "Schäden", icon: AlertTriangle },
  { value: "documents", label: "Dokumente", icon: FileText },
  { value: "announcements", label: "Mitteilungen", icon: Bell },
  { value: "contacts", label: "Kontakte", icon: Phone },
  { value: "settings", label: "Einstellungen", icon: Receipt },
];

export default function Admin() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  if (user && user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Kein Zugriff</h2>
          <p className="text-slate-500 mt-2">Dieser Bereich ist nur für Administratoren.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Administration" subtitle="FeelAtHomeNow – Verwaltung aller Daten und Einstellungen" />

      <Tabs defaultValue="finance" className="space-y-6">
        <TabsList className="bg-white border border-slate-200 p-1 flex-wrap h-auto gap-1">
          {tabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-xs gap-1.5">
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="finance"><AdminFinanceDashboard /></TabsContent>
        <TabsContent value="occupancy"><AdminOccupancyMap /></TabsContent>
        <TabsContent value="tenants"><AdminTenants /></TabsContent>
        <TabsContent value="properties"><AdminProperties /></TabsContent>
        <TabsContent value="leases"><AdminLeases /></TabsContent>
        <TabsContent value="handover"><AdminHandoverProtocols /></TabsContent>
        <TabsContent value="invoices"><AdminInvoices /></TabsContent>
        <TabsContent value="expenses"><AdminExpenses /></TabsContent>
        <TabsContent value="services"><AdminServiceTypes /></TabsContent>
        <TabsContent value="calendar"><AdminServiceCalendar /></TabsContent>
        <TabsContent value="damage"><AdminDamageReports /></TabsContent>
        <TabsContent value="documents"><AdminDocuments /></TabsContent>
        <TabsContent value="announcements"><AdminAnnouncements /></TabsContent>
        <TabsContent value="contacts"><AdminContacts /></TabsContent>
        <TabsContent value="settings"><AdminInvoiceSettings /></TabsContent>
      </Tabs>
    </div>
  );
}