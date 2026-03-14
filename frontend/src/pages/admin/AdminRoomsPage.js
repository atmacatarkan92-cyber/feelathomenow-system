import React, { useEffect, useMemo, useState } from "react";
import RoomMap from "../../components/RoomMap";
import RoomCalendar from "../../components/RoomCalendar";
import { fetchAdminUnits, fetchAdminRooms, normalizeUnit, normalizeRoom } from "../../api/adminData";

function StatCard({ label, value, hint, color = "slate" }) {
  const styles = {
    slate: "border-slate-200 bg-white text-slate-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <div className={`rounded-2xl border shadow-sm p-5 ${styles[color]}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      {hint ? <p className="text-xs opacity-70 mt-2">{hint}</p> : null}
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="mb-5">
        <h3 className="text-2xl font-semibold text-slate-800">{title}</h3>
        {subtitle ? <p className="text-slate-500 mt-1">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function AdminRoomsPage() {
  const [units, setUnits] = useState([]);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    fetchAdminUnits()
      .then((data) => setUnits(Array.isArray(data) ? data.map(normalizeUnit) : []))
      .catch(() => setUnits([]));
    fetchAdminRooms()
      .then((data) => setRooms(Array.isArray(data) ? data.map(normalizeRoom) : []))
      .catch(() => setRooms([]));
  }, []);

  const coLivingUnits = useMemo(() => {
    return units.filter((unit) => unit.type === "Co-Living");
  }, [units]);

  const roomStats = useMemo(() => {
    const occupied = rooms.filter((room) => room.status === "Belegt").length;
    const reserved = rooms.filter((room) => room.status === "Reserviert").length;
    const free = rooms.filter((room) => room.status === "Frei").length;

    return {
      total: rooms.length,
      occupied,
      reserved,
      free,
    };
  }, [rooms]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Zimmer</h2>
        <p className="text-slate-500 mt-1">
          Übersicht über alle Rooms, Status, Belegung und Vorschau pro Co-Living Unit.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Rooms gesamt"
          value={roomStats.total}
          hint="Alle erfassten Zimmer"
          color="slate"
        />
        <StatCard
          label="Belegt"
          value={roomStats.occupied}
          hint="Aktuell belegte Zimmer"
          color="green"
        />
        <StatCard
          label="Reserviert"
          value={roomStats.reserved}
          hint="Noch nicht eingezogen"
          color="amber"
        />
        <StatCard
          label="Frei"
          value={roomStats.free}
          hint="Aktuell ohne Belegung"
          color="rose"
        />
      </div>

      <SectionCard
        title="Room Map"
        subtitle="Visuelle Übersicht aller Zimmer pro Co-Living Unit"
      >
        <div className="space-y-6">
          {coLivingUnits.map((unit) => (
            <RoomMap key={unit.unitId || unit.id} unit={unit} rooms={rooms} />
          ))}

          {coLivingUnits.length === 0 && (
            <p className="text-slate-500">Keine Co-Living Units gefunden.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Belegungskalender"
        subtitle="Monatsvorschau pro Room mit sicher, Risiko, reserviert und frei"
      >
        <div className="space-y-6">
          {coLivingUnits.map((unit) => (
            <RoomCalendar key={unit.unitId || unit.id} unit={unit} rooms={rooms} />
          ))}

          {coLivingUnits.length === 0 && (
            <p className="text-slate-500">Keine Co-Living Units gefunden.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

export default AdminRoomsPage;