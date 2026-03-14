import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, XCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

export default function AdminServiceCalendar() {
  const queryClient = useQueryClient();

  const { data: bookings = [] } = useQuery({
    queryKey: ["admin-service-bookings"],
    queryFn: () => base44.entities.ServiceBooking.list("-scheduled_date"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ServiceBooking.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-service-bookings"] });
      toast.success("Status aktualisiert");
    },
  });

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getBookingsForDay = (day) => {
    return bookings.filter(b => {
      if (!b.scheduled_date) return false;
      return isSameDay(parseISO(b.scheduled_date), day);
    });
  };

  const statusColors = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    approved: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Service-Kalender - {format(now, "MMMM yyyy", { locale: de })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"].map((day, i) => (
              <div key={i} className="text-center text-xs font-semibold text-slate-500 py-2">{day}</div>
            ))}
            {Array.from({ length: monthStart.getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
            {daysInMonth.map(day => {
              const dayBookings = getBookingsForDay(day);
              const isToday = isSameDay(day, now);
              return (
                <div key={day.toISOString()} className={`min-h-24 p-2 border rounded-lg ${isToday ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}>
                  <div className={`text-xs font-semibold ${isToday ? "text-blue-700" : "text-slate-600"}`}>{format(day, "d")}</div>
                  <div className="space-y-1 mt-1">
                    {dayBookings.map(booking => (
                      <div key={booking.id} className={`text-xs p-1 rounded border ${statusColors[booking.status]}`}>
                        <div className="font-medium truncate">{booking.service_name}</div>
                        <div className="text-[10px] opacity-75">{booking.scheduled_time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Bookings List */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Anstehende Buchungen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bookings.filter(b => b.status === "pending" || b.status === "approved").map(booking => (
              <div key={booking.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">{booking.service_name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {booking.tenant_email} • {booking.scheduled_date ? format(parseISO(booking.scheduled_date), "d. MMM yyyy", { locale: de }) : "—"} {booking.scheduled_time && `um ${booking.scheduled_time}`}
                  </p>
                  {booking.notes && <p className="text-xs text-slate-600 mt-1 italic">"{booking.notes}"</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs ${statusColors[booking.status]}`}>{booking.status === "pending" ? "Ausstehend" : "Genehmigt"}</Badge>
                  {booking.status === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => updateStatusMutation.mutate({ id: booking.id, status: "approved" })}>
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => updateStatusMutation.mutate({ id: booking.id, status: "cancelled" })}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  {booking.status === "approved" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatusMutation.mutate({ id: booking.id, status: "completed" })}>
                      Abschließen
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}