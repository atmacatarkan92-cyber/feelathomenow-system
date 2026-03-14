import React from "react";

const STATUS_CONFIG = {
  occupied: {
    label: "Belegt",
    bg: "#DCFCE7",
    border: "#22C55E",
    text: "#166534",
    dot: "#16A34A",
  },
  reserved: {
    label: "Reserviert",
    bg: "#FEF9C3",
    border: "#EAB308",
    text: "#854D0E",
    dot: "#CA8A04",
  },
  free: {
    label: "Frei",
    bg: "#FEE2E2",
    border: "#EF4444",
    text: "#991B1B",
    dot: "#DC2626",
  },
  unknown: {
    label: "Unbekannt",
    bg: "#F1F5F9",
    border: "#94A3B8",
    text: "#475569",
    dot: "#64748B",
  },
};

function normalizeStatusFromRoom(room) {
  const s = (room?.status || "").toString().toLowerCase().trim();
  if (s === "belegt" || s === "occupied") return "occupied";
  if (s === "reserviert" || s === "reserved") return "reserved";
  if (s === "frei" || s === "free") return "free";
  return "unknown";
}

function getRoomDisplayList(unit, rooms = [], occupancyData = null) {
  const unitId = unit?.id ?? unit?.unitId ?? "";
  const roomList = Array.isArray(rooms)
    ? rooms.filter((r) => (r.unitId ?? r.unit_id) === unitId)
    : [];

  if (roomList.length === 0) return [];

  if (occupancyData && Array.isArray(occupancyData.rooms) && occupancyData.rooms.length > 0) {
    return occupancyData.rooms.map((occ) => ({
      room_id: occ.room_id,
      room_name: occ.room_name ?? occ.room_id,
      status: (occ.status || "free").toLowerCase().trim() || "free",
      tenant_name: occ.tenant_name ?? null,
      rent: occ.rent ?? occ.price ?? null,
    }));
  }

  return roomList.map((room, idx) => {
    const status = normalizeStatusFromRoom(room);
    return {
      room_id: room.id ?? room.roomId ?? `room-${idx}`,
      room_name: room.roomName ?? room.name ?? `Zimmer ${idx + 1}`,
      status: status === "unknown" ? "free" : status,
      tenant_name: room.tenant_name ?? room.tenantName ?? null,
      rent: room.rent ?? room.price ?? room.priceMonthly ?? null,
    };
  });
}

function RoomTile({ room }) {
  const config = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.unknown;
  const rentStr =
    room.rent != null
      ? `CHF ${Number(room.rent).toLocaleString("de-CH", { maximumFractionDigits: 0 })}`
      : null;

  return (
    <div
      style={{
        background: config.bg,
        border: `2px solid ${config.border}`,
        borderRadius: "12px",
        padding: "14px 16px",
        minHeight: "88px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: config.dot,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 700, color: config.text, fontSize: "15px" }}>
          {room.room_name}
        </span>
      </div>
      <div style={{ fontSize: "12px", fontWeight: 600, color: config.text }}>
        {config.label}
      </div>
      {room.tenant_name && (
        <div style={{ fontSize: "13px", color: config.text, opacity: 0.9 }}>
          {room.tenant_name}
        </div>
      )}
      {rentStr && (
        <div style={{ fontSize: "12px", color: config.text, opacity: 0.85 }}>
          {rentStr} / Monat
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px",
        alignItems: "center",
        fontSize: "13px",
        color: "#64748B",
      }}
    >
      <span style={{ fontWeight: 600, marginRight: "4px" }}>Legende:</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: "#16A34A",
          }}
        />
        Belegt
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: "#CA8A04",
          }}
        />
        Reserviert
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: "#DC2626",
          }}
        />
        Frei
      </span>
    </div>
  );
}

export default function OccupancyMap({ unit, rooms = [], occupancyData = null, loading = false }) {
  const displayList = getRoomDisplayList(unit, rooms, occupancyData);
  const unitTitle = unit?.title ?? unit?.place ?? unit?.unitId ?? unit?.id ?? "Unit";

  if (loading) {
    return (
      <div
        style={{
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "32px",
          textAlign: "center",
          color: "#64748B",
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Raumstatus wird geladen…</p>
      </div>
    );
  }

  if (!displayList.length) {
    return (
      <div
        style={{
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "32px",
          textAlign: "center",
          color: "#64748B",
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Keine Rooms für diese Unit vorhanden.</p>
        <p style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
          Räume unter Objekte anlegen, um die Belegung anzuzeigen.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ marginBottom: "16px" }}>
        <h4 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px 0", color: "#0F172A" }}>
          {unitTitle}
        </h4>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
          Raumstatus (Belegt / Reserviert / Frei)
        </p>
      </div>
      <div style={{ marginBottom: "16px" }}>
        <Legend />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        {displayList.map((room) => (
          <RoomTile key={room.room_id} room={room} />
        ))}
      </div>
    </div>
  );
}
