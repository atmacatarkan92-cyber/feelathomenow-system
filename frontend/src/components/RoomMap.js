import React from "react";

function getStatusStyle(status) {
  if (status === "Belegt") {
    return "bg-emerald-100 border-emerald-300 text-emerald-700";
  }

  if (status === "Reserviert") {
    return "bg-amber-100 border-amber-300 text-amber-700";
  }

  if (status === "Frei") {
    return "bg-rose-100 border-rose-300 text-rose-700";
  }

  return "bg-slate-100 border-slate-300 text-slate-700";
}

function getStatusLabel(status) {
  if (status === "Belegt") return "🟢 Belegt";
  if (status === "Reserviert") return "🟡 Reserviert";
  if (status === "Frei") return "🔴 Frei";
  return status || "Unbekannt";
}

function RoomMap({ unit, rooms: allRooms = [] }) {
  const unitRooms = allRooms.filter((room) => (room.unitId || room.unit_id) === (unit.unitId || unit.id));

  const occupiedCount = unitRooms.filter((room) => room.status === "Belegt").length;
  const reservedCount = unitRooms.filter((room) => room.status === "Reserviert").length;
  const freeCount = unitRooms.filter((room) => room.status === "Frei").length;

  if (unitRooms.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">
          {unit.unitId} – {unit.place}
        </p>
        <p className="text-sm text-slate-400 mt-2">
          Keine Rooms für diese Unit erfasst.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-slate-800">
          {unit.unitId} – {unit.place}
        </h4>

        <p className="text-sm text-slate-500 mt-1">
          Visuelle Übersicht aller Rooms dieser Unit
        </p>

        <div className="flex flex-wrap gap-2 mt-3">
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
            {unitRooms.length} Rooms
          </span>
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
            {occupiedCount} Belegt
          </span>
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
            {reservedCount} Reserviert
          </span>
          <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-medium">
            {freeCount} Frei
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {unitRooms.map((room, index) => (
          <div
            key={room.roomId || index}
            className={`rounded-xl border p-4 ${getStatusStyle(room.status)}`}
          >
            <p className="font-semibold">
              {room.roomName || room.name || `Zimmer ${index + 1}`}
            </p>

            <p className="text-xs mt-2 opacity-80">
              {getStatusLabel(room.status)}
            </p>

            {room.priceMonthly ? (
              <p className="text-xs mt-1 opacity-70">
                CHF {Number(room.priceMonthly).toLocaleString("de-CH")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default RoomMap;