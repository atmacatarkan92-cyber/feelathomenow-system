import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, DoorOpen, User, Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

export default function AdminOccupancyMap() {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignForm, setAssignForm] = useState({
    tenant_email: "", tenant_name: "", move_in_date: "", move_out_date: "", monthly_rent: ""
  });
  const queryClient = useQueryClient();

  const { data: properties = [] } = useQuery({
    queryKey: ["occupancy-properties"],
    queryFn: () => base44.entities.Property.list(),
  });

  const { data: leases = [] } = useQuery({
    queryKey: ["occupancy-leases"],
    queryFn: () => base44.entities.Lease.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["occupancy-users"],
    queryFn: () => base44.entities.User.list(),
  });

  const assignMutation = useMutation({
    mutationFn: (data) => base44.entities.Lease.create({
      ...data,
      property_id: selectedRoom.property_id,
      room_name: selectedRoom.room_name,
      lease_status: "active",
      monthly_rent: parseFloat(data.monthly_rent) || 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["occupancy-leases"] });
      setShowAssignDialog(false);
      setSelectedRoom(null);
      toast.success("Mieter erfolgreich zugewiesen");
    },
  });

  const getOccupancyStatus = (property, room = null) => {
    const now = new Date();
    let relevantLeases;

    if (room) {
      relevantLeases = leases.filter(l => 
        l.property_id === property.id && 
        l.room_name === room.name &&
        l.lease_status === "active"
      );
    } else {
      relevantLeases = leases.filter(l => 
        l.property_id === property.id && 
        !l.room_name &&
        l.lease_status === "active"
      );
    }

    if (relevantLeases.length === 0) return { status: "available", color: "bg-red-50 border-red-200", textColor: "text-red-700", label: "Frei" };

    const activeLease = relevantLeases[0];
    const moveOutDate = activeLease.move_out_date ? new Date(activeLease.move_out_date) : null;
    
    if (moveOutDate && moveOutDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
      return { status: "reserved", color: "bg-yellow-50 border-yellow-200", textColor: "text-yellow-700", label: "Bald frei", lease: activeLease };
    }

    return { status: "occupied", color: "bg-green-50 border-green-200", textColor: "text-green-700", label: "Belegt", lease: activeLease };
  };

  const openAssignDialog = (property, room = null) => {
    setSelectedRoom({ property_id: property.id, property_title: property.title, room_name: room?.name || "" });
    setAssignForm({ tenant_email: "", tenant_name: "", move_in_date: "", move_out_date: "", monthly_rent: room?.monthly_rent?.toString() || "" });
    setShowAssignDialog(true);
  };

  const tenants = users.filter(u => u.role === "user" || !u.role);

  // Stats
  const totalRooms = properties.reduce((sum, p) => sum + (p.rooms?.length || 1), 0);
  const occupiedRooms = properties.reduce((sum, p) => {
    if (p.rooms && p.rooms.length > 0) {
      return sum + p.rooms.filter(r => getOccupancyStatus(p, r).status === "occupied").length;
    }
    return sum + (getOccupancyStatus(p).status === "occupied" ? 1 : 0);
  }, 0);
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Gesamt Einheiten</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{totalRooms}</p>
              </div>
              <Home className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Belegt</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{occupiedRooms}</p>
              </div>
              <DoorOpen className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Auslastung</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{occupancyRate}%</p>
              </div>
              <div className="text-right">
                <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${occupancyRate}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Occupancy Map */}
      <div className="grid gap-4">
        {properties.map(property => (
          <Card key={property.id} className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{property.title}</CardTitle>
                  <p className="text-xs text-slate-500 mt-1">{property.address}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {property.rooms?.length || 1} {property.rooms?.length > 1 ? "Zimmer" : "Einheit"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {property.rooms && property.rooms.length > 0 ? (
                  property.rooms.map((room, idx) => {
                    const occupancy = getOccupancyStatus(property, room);
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border-2 ${occupancy.color} transition-all hover:shadow-md cursor-pointer`}
                        onClick={() => occupancy.status === "available" && openAssignDialog(property, room)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm">{room.name}</p>
                            <p className="text-xs text-slate-500">{room.size_sqm} m²</p>
                          </div>
                          <Badge className={`text-xs ${occupancy.textColor} bg-transparent border-0`}>
                            {occupancy.label}
                          </Badge>
                        </div>
                        {occupancy.lease ? (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <User className="w-3 h-3" />
                              <span className="font-medium">{occupancy.lease.tenant_name || occupancy.lease.tenant_email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                              <Calendar className="w-3 h-3" />
                              <span>
                                {occupancy.lease.move_in_date ? format(new Date(occupancy.lease.move_in_date), "dd.MM.yy", { locale: de }) : "—"} 
                                {occupancy.lease.move_out_date && ` - ${format(new Date(occupancy.lease.move_out_date), "dd.MM.yy", { locale: de })}`}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => openAssignDialog(property, room)}>
                              <Plus className="w-3 h-3 mr-1" />Mieter zuweisen
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div
                    className={`p-4 rounded-xl border-2 ${getOccupancyStatus(property).color} transition-all hover:shadow-md cursor-pointer`}
                    onClick={() => getOccupancyStatus(property).status === "available" && openAssignDialog(property)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-sm">Gesamte Wohnung</p>
                      <Badge className={`text-xs ${getOccupancyStatus(property).textColor} bg-transparent border-0`}>
                        {getOccupancyStatus(property).label}
                      </Badge>
                    </div>
                    {getOccupancyStatus(property).lease ? (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <User className="w-3 h-3" />
                          <span className="font-medium">{getOccupancyStatus(property).lease.tenant_name || getOccupancyStatus(property).lease.tenant_email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {getOccupancyStatus(property).lease.move_in_date ? format(new Date(getOccupancyStatus(property).lease.move_in_date), "dd.MM.yy", { locale: de }) : "—"} 
                            {getOccupancyStatus(property).lease.move_out_date && ` - ${format(new Date(getOccupancyStatus(property).lease.move_out_date), "dd.MM.yy", { locale: de })}`}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => openAssignDialog(property)}>
                          <Plus className="w-3 h-3 mr-1" />Mieter zuweisen
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assign Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mieter zuweisen</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              {selectedRoom?.property_title} {selectedRoom?.room_name && `- ${selectedRoom.room_name}`}
            </p>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Mieter</Label>
              <Select value={assignForm.tenant_email} onValueChange={(v) => {
                const user = tenants.find(u => u.email === v);
                setAssignForm({ ...assignForm, tenant_email: v, tenant_name: user?.full_name || "" });
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Mieter wählen" /></SelectTrigger>
                <SelectContent>
                  {tenants.map(u => <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Einzugsdatum</Label>
                <Input type="date" value={assignForm.move_in_date} onChange={(e) => setAssignForm({ ...assignForm, move_in_date: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Auszugsdatum</Label>
                <Input type="date" value={assignForm.move_out_date} onChange={(e) => setAssignForm({ ...assignForm, move_out_date: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Monatsmiete (CHF)</Label>
              <Input type="number" value={assignForm.monthly_rent} onChange={(e) => setAssignForm({ ...assignForm, monthly_rent: e.target.value })} className="mt-1" />
            </div>
            <Button onClick={() => assignMutation.mutate(assignForm)} disabled={!assignForm.tenant_email || assignMutation.isPending} className="w-full bg-slate-900 hover:bg-slate-800">
              {assignMutation.isPending ? "Wird zugewiesen..." : "Zuweisen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}