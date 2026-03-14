import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";
import StatusBadge from "../shared/StatusBadge";

export default function AdminTenants() {
  const [search, setSearch] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: leases = [] } = useQuery({
    queryKey: ["admin-leases"],
    queryFn: () => base44.entities.Lease.list(),
  });

  const tenants = users.filter(u => u.role === "tenant" || !u.role || u.role === "user");
  const filtered = tenants.filter(t =>
    (t.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Mieter suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{filtered.length} Mieter</Badge>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Mietvertrag</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(tenant => {
                const lease = leases.find(l => l.tenant_email === tenant.email);
                return (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.full_name || "—"}</TableCell>
                    <TableCell className="text-sm text-slate-500">{tenant.email}</TableCell>
                    <TableCell className="text-sm">{tenant.phone || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {lease ? `CHF ${lease.monthly_rent?.toLocaleString("de-CH")}` : "—"}
                    </TableCell>
                    <TableCell>
                      {lease ? <StatusBadge status={lease.lease_status} /> : <Badge variant="outline" className="text-xs">Kein Vertrag</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}