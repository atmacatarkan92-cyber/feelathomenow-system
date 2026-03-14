import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, MessageCircle, Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";

const roleLabels = {
  management: "Verwaltung",
  rental_support: "Vermietung / Support",
  caretaker: "Hauswart",
  cleaning: "Reinigung",
  emergency: "Notfallkontakt",
};

const roleColors = {
  management: "bg-blue-50 text-blue-700 border-blue-200",
  rental_support: "bg-emerald-50 text-emerald-700 border-emerald-200",
  caretaker: "bg-amber-50 text-amber-700 border-amber-200",
  cleaning: "bg-purple-50 text-purple-700 border-purple-200",
  emergency: "bg-red-50 text-red-700 border-red-200",
};

export default function Contacts() {
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list(),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Kontakte" subtitle="Ihre Ansprechpartner" />

      {contacts.length === 0 ? (
        <EmptyState icon={Users} title="Keine Kontakte" description="Noch keine Kontakte hinterlegt." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {contacts.map(contact => (
            <Card key={contact.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {contact.photo_url ? (
                    <img src={contact.photo_url} alt={contact.name} className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-lg font-semibold text-slate-500">
                      {contact.name?.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{contact.name}</h4>
                    <Badge variant="outline" className={`mt-1 text-[10px] ${roleColors[contact.role] || ""}`}>
                      {roleLabels[contact.role] || contact.role}
                    </Badge>
                    {contact.availability && (
                      <p className="text-xs text-slate-500 mt-2">{contact.availability}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors">
                          <Phone className="w-3 h-3" />{contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors">
                          <Mail className="w-3 h-3" />{contact.email}
                        </a>
                      )}
                      {contact.whatsapp && (
                        <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-200 transition-colors">
                          <MessageCircle className="w-3 h-3" />WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}