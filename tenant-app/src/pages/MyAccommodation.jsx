import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Wifi, BookOpen, DoorOpen, DoorClosed,
  Trash2, WashingMachine, Thermometer, Key, Check
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

const infoSections = [
  { key: "check_in_info", label: "Check-in", icon: DoorOpen },
  { key: "check_out_info", label: "Check-out", icon: DoorClosed },
  { key: "waste_disposal_info", label: "Müllentsorgung", icon: Trash2 },
  { key: "laundry_info", label: "Waschmaschine", icon: WashingMachine },
  { key: "heating_info", label: "Heizung", icon: Thermometer },
  { key: "key_handover_info", label: "Schlüsselübergabe", icon: Key },
];

export default function MyAccommodation() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: leases = [] } = useQuery({
    queryKey: ["my-leases", user?.email],
    queryFn: () => base44.entities.Lease.filter({ tenant_email: user.email }),
    enabled: !!user?.email,
  });

  const activeLease = leases.find(l => l.lease_status === "active") || leases[0];

  const { data: property, isLoading } = useQuery({
    queryKey: ["property", activeLease?.property_id],
    queryFn: () => base44.entities.Property.filter({ id: activeLease.property_id }),
    enabled: !!activeLease?.property_id,
    select: (data) => data[0],
  });

  if (isLoading || !user) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="space-y-6">
        <PageHeader title="Meine Unterkunft" subtitle="Details zu Ihrer Wohnung" />
        <Card className="border-0 shadow-sm p-8 text-center">
          <p className="text-slate-500">Noch keine Unterkunft zugewiesen.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Meine Unterkunft" subtitle={property.title} />

      {/* Photo Gallery */}
      {property.photos?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {property.photos.map((photo, i) => (
            <div key={i} className={`rounded-2xl overflow-hidden ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
              <img src={photo} alt={`${property.title} ${i + 1}`} className="w-full h-full object-cover aspect-video" />
            </div>
          ))}
        </div>
      )}

      {/* Address & Details */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{property.title}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{property.address}</p>
              {property.city && <p className="text-sm text-slate-500">{property.zip_code} {property.city}</p>}
              {property.description && <p className="text-sm text-slate-600 mt-3">{property.description}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Amenities */}
      {property.amenities?.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ausstattung</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {property.amenities.map((a, i) => (
                <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-700 font-normal px-3 py-1.5">
                  <Check className="w-3 h-3 mr-1.5 text-emerald-500" />
                  {a}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WLAN */}
      {(property.wifi_name || property.wifi_password) && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Wifi className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900">WLAN</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 pl-[52px]">
              {property.wifi_name && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Netzwerk</p>
                  <p className="text-sm font-medium text-slate-900 mt-0.5 font-mono">{property.wifi_name}</p>
                </div>
              )}
              {property.wifi_password && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Passwort</p>
                  <p className="text-sm font-medium text-slate-900 mt-0.5 font-mono">{property.wifi_password}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* House Rules */}
      {property.house_rules && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Hausregeln</h3>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-line pl-[52px]">{property.house_rules}</p>
          </CardContent>
        </Card>
      )}

      {/* Info Sections */}
      <div className="grid sm:grid-cols-2 gap-4">
        {infoSections.map(({ key, label, icon: Icon }) => {
          if (!property[key]) return null;
          return (
            <Card key={key} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <Icon className="w-4 h-4 text-slate-400" />
                  <h4 className="text-sm font-semibold text-slate-900">{label}</h4>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-line">{property[key]}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rooms */}
      {property.rooms?.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Zimmer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {property.rooms.map((room, i) => (
              <div key={i} className="p-4 bg-slate-50 rounded-xl">
                <h4 className="font-medium text-slate-900">{room.name}</h4>
                {room.description && <p className="text-sm text-slate-500 mt-1">{room.description}</p>}
                {room.size_sqm && <p className="text-xs text-slate-400 mt-1">{room.size_sqm} m²</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}