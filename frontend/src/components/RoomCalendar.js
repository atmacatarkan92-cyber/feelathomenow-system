import React from "react";

const DEFAULT_MIN_STAY_MONTHS = 3;
const DEFAULT_NOTICE_PERIOD_MONTHS = 3;
const MONTH_PREVIEW_COUNT = 9;

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatMonthLabel(date) {
  return date.toLocaleDateString("de-CH", {
    month: "short",
    year: "2-digit",
  });
}

function formatCurrency(value) {
  return `CHF ${Math.round(Number(value || 0)).toLocaleString("de-CH")}`;
}

function getMonthBarStyle(type) {
  if (type === "secure") {
    return "bg-emerald-500 text-white";
  }

  if (type === "risk") {
    return "bg-amber-400 text-slate-900";
  }

  if (type === "reserved") {
    return "bg-sky-400 text-white";
  }

  return "bg-rose-500 text-white";
}

function getLegendText(type) {
  if (type === "secure") return "Sicher";
  if (type === "risk") return "Risiko";
  if (type === "reserved") return "Reserviert";
  return "Frei";
}

function getRoomMonthlyTimeline(room) {
  const today = new Date();
  const currentMonthStart = startOfMonth(today);

  const moveInDate = room.moveInDate ? new Date(room.moveInDate) : null;
  const minimumStayMonths = Number(
    room.minimumStayMonths || DEFAULT_MIN_STAY_MONTHS
  );
  const noticePeriodMonths = Number(
    room.noticePeriodMonths || DEFAULT_NOTICE_PERIOD_MONTHS
  );

  const secureMonths = minimumStayMonths + noticePeriodMonths;

  return Array.from({ length: MONTH_PREVIEW_COUNT }, (_, index) => {
    const monthDate = addMonths(currentMonthStart, index);

    if (room.status === "Frei") {
      return {
        label: formatMonthLabel(monthDate),
        type: "free",
      };
    }

    if (room.status === "Reserviert") {
      return {
        label: formatMonthLabel(monthDate),
        type: index === 0 ? "reserved" : "free",
      };
    }

    if (room.status === "Belegt") {
      if (moveInDate && !Number.isNaN(moveInDate.getTime())) {
        const secureUntilDate = addMonths(moveInDate, secureMonths);
        const riskUntilDate = addMonths(secureUntilDate, 1);

        if (monthDate < secureUntilDate) {
          return {
            label: formatMonthLabel(monthDate),
            type: "secure",
          };
        }

        if (monthDate >= secureUntilDate && monthDate < riskUntilDate) {
          return {
            label: formatMonthLabel(monthDate),
            type: "risk",
          };
        }

        return {
          label: formatMonthLabel(monthDate),
          type: "free",
        };
      }

      if (index < secureMonths) {
        return {
          label: formatMonthLabel(monthDate),
          type: "secure",
        };
      }

      if (index === secureMonths) {
        return {
          label: formatMonthLabel(monthDate),
          type: "risk",
        };
      }

      return {
        label: formatMonthLabel(monthDate),
        type: "free",
      };
    }

    return {
      label: formatMonthLabel(monthDate),
      type: "free",
    };
  });
}

function getRiskMonthsCount(timeline) {
  return timeline.filter((item) => item.type === "risk").length;
}

function getFreeMonthsCount(timeline) {
  return timeline.filter((item) => item.type === "free").length;
}

function getEstimatedLostRevenue(room, timeline) {
  const monthly = Number(room.priceMonthly || 0);
  if (!monthly) return 0;

  const freeMonths = getFreeMonthsCount(timeline);
  const riskMonths = getRiskMonthsCount(timeline);

  return freeMonths * monthly + riskMonths * (monthly * 0.5);
}

function RoomCalendar({ unit, rooms: allRooms = [] }) {
  const unitRooms = allRooms.filter((room) => (room.unitId || room.unit_id) === (unit.unitId || unit.id));

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

  const unitFreeMonths = unitRooms.reduce((sum, room) => {
    const timeline = getRoomMonthlyTimeline(room);
    return sum + getFreeMonthsCount(timeline);
  }, 0);

  const unitRiskMonths = unitRooms.reduce((sum, room) => {
    const timeline = getRoomMonthlyTimeline(room);
    return sum + getRiskMonthsCount(timeline);
  }, 0);

  const unitEstimatedLostRevenue = unitRooms.reduce((sum, room) => {
    const timeline = getRoomMonthlyTimeline(room);
    return sum + getEstimatedLostRevenue(room, timeline);
  }, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-slate-800">
          {unit.unitId} – {unit.place}
        </h4>

        <p className="text-sm text-slate-500 mt-1">
          Visueller Monatskalender über {MONTH_PREVIEW_COUNT} Monate
        </p>

        <div className="flex flex-wrap gap-2 mt-3">
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
            {unitRooms.length} Rooms
          </span>

          <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-medium">
            {unitFreeMonths} freie Monate
          </span>

          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
            {unitRiskMonths} Risiko-Monate
          </span>

          <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-medium">
            {formatCurrency(unitEstimatedLostRevenue)} potenzieller Verlust
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {unitRooms.map((room, index) => {
          const timeline = getRoomMonthlyTimeline(room);
          const freeMonths = getFreeMonthsCount(timeline);
          const riskMonths = getRiskMonthsCount(timeline);
          const estimatedLostRevenue = getEstimatedLostRevenue(room, timeline);

          return (
            <div
              key={room.roomId || index}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    {room.roomName || room.name || `Zimmer ${index + 1}`}
                  </p>

                  <p className="text-xs text-slate-500 mt-1">
                    {room.status || "Unbekannt"}
                    {room.priceMonthly
                      ? ` · CHF ${Number(room.priceMonthly).toLocaleString("de-CH")}`
                      : ""}
                    {room.moveInDate ? ` · Einzug ${room.moveInDate}` : ""}
                    {` · Mindestdauer ${Number(
                      room.minimumStayMonths || DEFAULT_MIN_STAY_MONTHS
                    )}M`}
                    {` · Kündigung ${Number(
                      room.noticePeriodMonths || DEFAULT_NOTICE_PERIOD_MONTHS
                    )}M`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-medium">
                    {freeMonths} freie Monate
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                    {riskMonths} Risiko-Monate
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-medium">
                    {formatCurrency(estimatedLostRevenue)} Risiko
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-9 gap-3">
                {timeline.map((month) => (
                  <div key={`${room.roomId || index}-${month.label}`}>
                    <div className="text-[11px] text-slate-500 mb-1">
                      {month.label}
                    </div>
                    <div
                      className={`h-10 rounded-xl flex items-center justify-center text-xs font-semibold ${getMonthBarStyle(
                        month.type
                      )}`}
                    >
                      {getLegendText(month.type)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RoomCalendar;