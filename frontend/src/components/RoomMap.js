import React from "react";
import {
  getRoomOccupancyStatus,
  formatOccupancyStatusDe,
} from "../utils/unitOccupancyStatus";

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

function getStatusLabelFromOcc(occ) {
  if (occ == null) return "—";
  const de = formatOccupancyStatusDe(occ);
  if (occ === "belegt") return `🟢 ${de}`;
  if (occ === "reserviert") return `🟡 ${de}`;
  if (occ === "frei") return `🔴 ${de}`;
  return de;
}

function getStatusStyleFromOcc(occ) {
  if (occ === "belegt") return getStatusStyle("Belegt");
  if (occ === "reserviert") return getStatusStyle("Reserviert");
  if (occ === "frei") return getStatusStyle("Frei");
  return getStatusStyle("Frei");
}

function RoomMap({ unit, rooms: allRooms = [], tenancies = null }) {
  const unitRooms = allRooms.filter((room) => (room.unitId || room.unit_id) === (unit.unitId || unit.id));

  const occupiedCount =
    tenancies == null
      ? 0
      : unitRooms.filter(
          (room) => getRoomOccupancyStatus(room, tenancies) === "belegt"
        ).length;
  const reservedCount =
    tenancies == null
      ? 0
      : unitRooms.filter(
          (room) => getRoomOccupancyStatus(room, tenancies) === "reserviert"
        ).length;
  const freeCount =
    tenancies == null
      ? unitRooms.length
      : unitRooms.filter(
          (room) => getRoomOccupancyStatus(room, tenancies) === "frei"
        ).length;

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
        {unitRooms.map((room, index) => {
          const occ =
            tenancies != null ? getRoomOccupancyStatus(room, tenancies) : null;
          return (
          <div
            key={room.roomId || index}
            className={`rounded-xl border p-4 ${getStatusStyleFromOcc(occ)}`}
          >
            <p className="font-semibold">
              {room.roomName || room.name || `Zimmer ${index + 1}`}
            </p>

            <p className="text-xs mt-2 opacity-80">
              {getStatusLabelFromOcc(occ)}
            </p>

            {room.priceMonthly ? (
              <p className="text-xs mt-1 opacity-70">
                CHF {Number(room.priceMonthly).toLocaleString("de-CH")}
              </p>
            ) : null}
          </div>
          );
        })}
      </div>
    </div>
  );
}

export default RoomMap;