import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

const categoryIcons = {
  cleaning: "🧹",
  maintenance: "🔧",
  keys: "🔑",
  parking: "🅿️",
  checkout: "🚪",
  other: "✨",
};

export default function Services() {
  const [user, setUser] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [bookForm, setBookForm] = useState({ scheduled_date: "", scheduled_time: "", notes: "" });
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["available-services"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  const { data: myBookings = [] } = useQuery({
    queryKey: ["my-service-bookings", user?.email],
    queryFn: () => base44.entities.ServiceBooking.filter({ tenant_email: user.email }, "-scheduled_date"),
    enabled: !!user?.email,
  });

  const { data: myLeases = [] } = useQuery({
    queryKey: ["my-service-leases", user?.email],
    queryFn: () => base44.entities.Lease.filter({ tenant_email: user.email, lease_status: "active" }),
    enabled: !!user?.email,
  });

  const bookMutation = useMutation({
    mutationFn: async (data) => {
      const booking = await base44.entities.ServiceBooking.create({
        ...data,
        tenant_email: user.email,
        property_id: myLeases[0]?.property_id || "",
        service_type_id: selectedService.id,
        service_name: selectedService.name,
        price: selectedService.price || 0,
        status: selectedService.requires_approval ? "pending" : "approved",
      });

      // Create invoice if service has a price
      if (selectedService.price > 0) {
        const now = new Date();
        const invoiceDate = now.toISOString().split('T')[0];
        const dueDate = new Date(now.setDate(now.getDate() + 10)).toISOString().split('T')[0];

        await base44.entities.Invoice.create({
          tenant_email: user.email,
          invoice_number: `SRV-${Date.now()}`,
          invoice_date: invoiceDate,
          due_date: dueDate,
          period_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
          rent_amount: 0,
          total_amount: selectedService.price,
          status: "open",
          other_charges: [{ description: selectedService.name, amount: selectedService.price }],
        });
      }

      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-service-bookings"] });
      setShowBookDialog(false);
      setBookForm({ scheduled_date: "", scheduled_time: "", notes: "" });
      toast.success("Service erfolgreich gebucht");
    },
  });

  const openBookDialog = (service) => {
    setSelectedService(service);
    setBookForm({ scheduled_date: "", scheduled_time: "", notes: "" });
    setShowBookDialog(true);
  };

  const statusLabels = {
    pending: "Ausstehend",
    approved: "Genehmigt",
    completed: "Abgeschlossen",
    cancelled: "Storniert",
  };

  const statusColors = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    approved: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Services" subtitle="Buchen Sie zusätzliche Leistungen für Ihre Unterkunft" />

      {/* Available Services */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Verfügbare Services</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {serviceTypes.map(service => (
            <Card key={service.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{categoryIcons[service.category]}</span>
                    <CardTitle className="text-base">{service.name}</CardTitle>
                  </div>
                  {service.price > 0 && (
                    <Badge variant="outline" className="text-xs font-semibold">CHF {service.price.toFixed(2)}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-4">{service.description}</p>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{service.duration_minutes} min</span>
                  </div>
                  {service.requires_approval && <Badge variant="outline" className="text-xs">Genehmigung nötig</Badge>}
                </div>
                <Button onClick={() => openBookDialog(service)} className="w-full bg-slate-900 hover:bg-slate-800">
                  Jetzt buchen
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* My Bookings */}
      {myBookings.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Meine Buchungen</h2>
          <div className="space-y-3">
            {myBookings.map(booking => (
              <Card key={booking.id} className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{categoryIcons[serviceTypes.find(s => s.id === booking.service_type_id)?.category || "other"]}</span>
                      <div>
                        <h4 className="font-semibold text-slate-900">{booking.service_name}</h4>
                        <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                          {booking.scheduled_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{format(new Date(booking.scheduled_date), "d. MMMM yyyy", { locale: de })}</span>
                            </div>
                          )}
                          {booking.scheduled_time && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{booking.scheduled_time}</span>
                            </div>
                          )}
                        </div>
                        {booking.notes && <p className="text-sm text-slate-600 mt-2 italic">"{booking.notes}"</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={`text-xs ${statusColors[booking.status]}`}>
                        {statusLabels[booking.status]}
                      </Badge>
                      {booking.price > 0 && (
                        <span className="text-sm font-semibold text-slate-700">CHF {booking.price.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {serviceTypes.length === 0 && (
        <EmptyState icon={Sparkles} title="Keine Services verfügbar" description="Aktuell sind keine zusätzlichen Services verfügbar." />
      )}

      {/* Book Dialog */}
      <Dialog open={showBookDialog} onOpenChange={setShowBookDialog}>
        <DialogContent>
          {selectedService && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-2xl">{categoryIcons[selectedService.category]}</span>
                  {selectedService.name}
                </DialogTitle>
                <p className="text-sm text-slate-500 mt-2">{selectedService.description}</p>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Datum</Label>
                    <Input type="date" value={bookForm.scheduled_date} onChange={(e) => setBookForm({ ...bookForm, scheduled_date: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label>Uhrzeit</Label>
                    <Input type="time" value={bookForm.scheduled_time} onChange={(e) => setBookForm({ ...bookForm, scheduled_time: e.target.value })} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Anmerkungen (optional)</Label>
                  <Textarea value={bookForm.notes} onChange={(e) => setBookForm({ ...bookForm, notes: e.target.value })} className="mt-1 h-20" placeholder="Besondere Wünsche oder Hinweise..." />
                </div>
                {selectedService.price > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-900">
                      <strong>Preis:</strong> CHF {selectedService.price.toFixed(2)}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">Eine Rechnung wird automatisch erstellt.</p>
                  </div>
                )}
                {selectedService.requires_approval && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-xs text-yellow-800">Ihre Buchung muss vom Admin genehmigt werden.</p>
                  </div>
                )}
                <Button onClick={() => bookMutation.mutate(bookForm)} disabled={!bookForm.scheduled_date || bookMutation.isPending} className="w-full bg-slate-900 hover:bg-slate-800">
                  {bookMutation.isPending ? "Wird gebucht..." : "Service buchen"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}