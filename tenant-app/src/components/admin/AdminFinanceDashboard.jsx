import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Home, DoorOpen, AlertCircle, CheckCircle2, DollarSign, TrendingDown } from "lucide-react";

export default function AdminFinanceDashboard() {
  const { data: invoices = [] } = useQuery({
    queryKey: ["all-invoices"],
    queryFn: () => base44.entities.Invoice.list("-created_date"),
  });

  const { data: leases = [] } = useQuery({
    queryKey: ["all-leases"],
    queryFn: () => base44.entities.Lease.list(),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["all-properties"],
    queryFn: () => base44.entities.Property.list(),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["all-expenses"],
    queryFn: () => base44.entities.Expense.list(),
  });

  const { data: serviceBookings = [] } = useQuery({
    queryKey: ["all-service-bookings"],
    queryFn: () => base44.entities.ServiceBooking.list(),
  });

  // Calculate totals
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const serviceRevenue = serviceBookings.filter(s => s.status === "completed").reduce((sum, s) => sum + (s.price || 0), 0);
  const totalProfit = totalRevenue + serviceRevenue - totalExpenses;
  const openAmount = invoices.filter(i => i.status === "open" || i.status === "sent").reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const overdueAmount = invoices.filter(i => i.status === "overdue").reduce((sum, i) => sum + (i.total_amount || 0), 0);

  // Revenue and profit by property
  const revenueByProperty = {};
  properties.forEach(prop => {
    const propLeases = leases.filter(l => l.property_id === prop.id);
    const propInvoices = invoices.filter(inv => 
      propLeases.some(l => l.id === inv.lease_id) && inv.status === "paid"
    );
    const propExpenses = expenses.filter(e => e.property_id === prop.id);
    const revenue = propInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    const cost = propExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    revenueByProperty[prop.id] = {
      title: prop.title,
      revenue: revenue,
      expenses: cost,
      profit: revenue - cost,
      open: invoices.filter(inv => 
        propLeases.some(l => l.id === inv.lease_id) && (inv.status === "open" || inv.status === "sent")
      ).reduce((sum, i) => sum + (i.total_amount || 0), 0),
    };
  });

  // Revenue by month (last 6 months)
  const now = new Date();
  const monthlyRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const monthInvoices = invoices.filter(inv => inv.period_month === monthKey && inv.status === "paid");
    monthlyRevenue.push({
      month: month.toLocaleDateString('de-CH', { month: 'short', year: 'numeric' }),
      revenue: monthInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
    });
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Einnahmen</p>
                <p className="text-2xl font-bold text-green-600 mt-1">CHF {(totalRevenue + serviceRevenue).toLocaleString('de-CH', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-slate-500 mt-1">Miete + Services</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Ausgaben</p>
                <p className="text-2xl font-bold text-red-600 mt-1">CHF {totalExpenses.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-slate-500 mt-1">Betriebskosten</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-amber-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-700 uppercase tracking-wider font-semibold">Gewinn</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">CHF {totalProfit.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-orange-600 mt-1">Einnahmen - Ausgaben</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Überfällig</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">CHF {overdueAmount.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Auslastung</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {(() => {
                    const totalUnits = properties.reduce((sum, p) => sum + (p.rooms?.length || 1), 0);
                    const occupiedUnits = leases.filter(l => l.lease_status === "active").length;
                    return totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
                  })()}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center">
                <Home className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Einnahmen letzte 6 Monate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monthlyRevenue.map((m, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-20 text-sm text-slate-600">{m.month}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-8 relative overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full flex items-center justify-end px-3"
                    style={{ width: `${Math.min((m.revenue / Math.max(...monthlyRevenue.map(x => x.revenue))) * 100, 100)}%` }}
                  >
                    <span className="text-xs font-semibold text-white">CHF {m.revenue.toLocaleString('de-CH')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue and Profit by Property */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Gewinn pro Unterkunft</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Unterkunft</TableHead>
                <TableHead>Einnahmen</TableHead>
                <TableHead>Ausgaben</TableHead>
                <TableHead>Gewinn</TableHead>
                <TableHead>Offen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.values(revenueByProperty).map((prop, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{prop.title}</TableCell>
                  <TableCell className="text-green-600">CHF {prop.revenue.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-red-600">CHF {prop.expenses.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className={`font-semibold ${prop.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    CHF {prop.profit.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-slate-600">CHF {prop.open.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}