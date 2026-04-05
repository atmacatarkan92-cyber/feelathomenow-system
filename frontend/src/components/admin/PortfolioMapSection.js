/**
 * Global portfolio map: all unit types, property coordinates only, client-side filters.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { fetchAdminPortfolioMap, sanitizeClientErrorMessage } from "../../api/adminData";
import { normalizeUnitTypeLabel } from "../../utils/unitDisplayId";

function SectionCard({ title, subtitle, children, rightSlot = null }) {
  return (
    <div className="rounded-[14px] border border-black/10 bg-white p-5 dark:border-white/[0.07] dark:bg-[#141824]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#0f172a] dark:text-[#eef2ff]">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-sm text-[#64748b] dark:text-[#6b7a9a]">{subtitle}</p>
          ) : null}
        </div>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

function portfolioMapCircleStyle(mapStatus) {
  switch (mapStatus) {
    case "occupied":
      return { color: "#166534", fillColor: "#22c55e" };
    case "vacant":
      return { color: "#b91c1c", fillColor: "#ef4444" };
    case "notice":
      return { color: "#a16207", fillColor: "#eab308" };
    case "landlord_ended":
      return { color: "#475569", fillColor: "#94a3b8" };
    default:
      return { color: "#64748b", fillColor: "#cbd5e1" };
  }
}

function portfolioMapStatusEmoji(mapStatus) {
  switch (mapStatus) {
    case "occupied":
      return "🟢";
    case "vacant":
      return "🔴";
    case "notice":
      return "🟡";
    case "landlord_ended":
      return "⚫";
    default:
      return "•";
  }
}

function portfolioMapTypeLabel(apiType) {
  const t = String(apiType || "").trim();
  if (t === "Business Apartment") return "Business Apartment";
  if (t === "Apartment") return "Apartment";
  const n = normalizeUnitTypeLabel(t);
  if (n === "Co-Living") return "Co-Living";
  return t || "—";
}

function isApartmentFamilyType(apiType) {
  const t = String(apiType || "").trim();
  return t === "Apartment" || t === "Business Apartment";
}

function isCoLivingType(apiType) {
  return normalizeUnitTypeLabel(apiType) === "Co-Living";
}

function PortfolioMapFitBounds({ items }) {
  const map = useMap();
  useEffect(() => {
    if (!items?.length) return;
    if (items.length === 1) {
      const it = items[0];
      map.setView([Number(it.latitude), Number(it.longitude)], 14, {
        animate: false,
      });
      return;
    }
    const b = L.latLngBounds(
      items.map((it) => [Number(it.latitude), Number(it.longitude)])
    );
    map.fitBounds(b, { padding: [36, 36], maxZoom: 15, animate: false });
  }, [map, items]);
  return null;
}

function PortfolioMapPopupBody({ it }) {
  const shortId = String(it.short_unit_id || it.unit_id || "").trim() || "—";
  const city = String(it.city || "").trim();
  const line1 =
    shortId !== "—" && city
      ? `${shortId} · ${city}`
      : shortId !== "—"
        ? shortId
        : city || "—";

  const typeLine = portfolioMapTypeLabel(it.type);
  const coLivingExtra =
    isCoLivingType(it.type) && Number(it.rooms) > 0
      ? `${Number(it.rooms)} Zimmer · ${Number(it.occupied_rooms ?? 0)} belegt`
      : null;

  const addressLine = String(it.address || "").trim();
  const postal = String(it.postal_code || "").trim();
  const postalCity = [postal, city].filter(Boolean).join(" ");

  return (
    <div className="min-w-[200px] max-w-[260px] space-y-1.5 text-[13px] leading-snug text-[#0f172a]">
      <p className="font-semibold text-slate-900">{line1}</p>
      <p className="text-[12px] text-slate-600">{typeLine}</p>
      {coLivingExtra ? (
        <p className="text-[12px] text-slate-500">{coLivingExtra}</p>
      ) : null}
      <div className="flex items-center gap-1.5 pt-0.5">
        <span className="text-[15px] leading-none" aria-hidden>
          {portfolioMapStatusEmoji(it.map_status)}
        </span>
        <span className="font-medium text-slate-800">{it.map_status_label}</span>
      </div>
      {addressLine ? (
        <p className="pt-0.5 text-slate-600">{addressLine}</p>
      ) : null}
      {postalCity ? (
        <p className="text-[12px] text-slate-500">{postalCity}</p>
      ) : null}
      <Link
        to={`/admin/units/${encodeURIComponent(it.unit_id)}`}
        className="inline-block pt-1 text-sky-600 underline decoration-sky-600/40 underline-offset-2 hover:text-sky-700"
      >
        Einheit öffnen
      </Link>
    </div>
  );
}

function filterMapItems(items, filterType, filterStatus, filterCity) {
  if (!Array.isArray(items)) return [];
  return items.filter((it) => {
    if (!it) return false;
    const t = String(it.type || "").trim();
    if (filterType === "apartments") {
      if (!isApartmentFamilyType(t)) return false;
    } else if (filterType === "coliving") {
      if (!isCoLivingType(t)) return false;
    }
    if (filterStatus !== "all" && it.map_status !== filterStatus) {
      return false;
    }
    if (filterCity !== "all") {
      const c = String(it.city || "").trim();
      if (c !== filterCity) return false;
    }
    return true;
  });
}

export default function PortfolioMapSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCity, setFilterCity] = useState("all");

  useEffect(() => {
    fetchAdminPortfolioMap()
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => {
        setData(null);
        setError(
          sanitizeClientErrorMessage(
            e?.message,
            "Portfolio-Karte konnte nicht geladen werden."
          )
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const items = data?.items;
  const filteredItems = useMemo(
    () => filterMapItems(items, filterType, filterStatus, filterCity),
    [items, filterType, filterStatus, filterCity]
  );

  const plottedItems = useMemo(() => {
    return filteredItems.filter(
      (it) =>
        it &&
        it.has_coordinates &&
        it.latitude != null &&
        it.longitude != null
    );
  }, [filteredItems]);

  const cityOptions = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const s = new Set();
    for (const it of items) {
      const c = String(it?.city || "").trim();
      if (c) s.add(c);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "de-CH"));
  }, [items]);

  const hasActiveFilters =
    filterType !== "all" || filterStatus !== "all" || filterCity !== "all";

  const defaultMapCenter = [46.8, 8.2];
  const defaultMapZoom = 7;

  if (loading) {
    return (
      <SectionCard
        title="Portfolio-Karte"
        subtitle="Globale Übersicht aller Einheiten · Standorte aus Liegenschaftskoordinaten"
      >
        <p className="py-8 text-sm text-[#64748b] dark:text-[#6b7a9a]">Karte wird geladen…</p>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard
        title="Portfolio-Karte"
        subtitle="Globale Übersicht aller Einheiten · Standorte aus Liegenschaftskoordinaten"
      >
        <p className="py-4 text-sm text-[#f87171]">{error}</p>
      </SectionCard>
    );
  }

  const summary = data?.summary || {};
  const total = Number(summary.total_units) || 0;
  const plotted = Number(summary.plotted_units) || 0;
  const missing = Number(summary.missing_coordinates) || 0;

  return (
    <SectionCard
      title="Portfolio-Karte"
      subtitle="Alle Einheitstypen · Statusfarben · nur Marker mit Koordinaten an der Liegenschaft"
    >
      <p className="mb-4 text-sm font-medium text-[#0f172a] dark:text-[#eef2ff]">
        {total} Einheiten · {plotted} auf Karte · {missing} ohne Koordinaten
      </p>

      {hasActiveFilters && (
        <p className="mb-3 text-xs text-[#64748b] dark:text-[#6b7a9a]">
          Nach Filter: {filteredItems.length} Einheiten · {plottedItems.length} Marker
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-[11px] font-medium text-[#64748b] dark:text-[#6b7a9a]">
            Typ
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full rounded-lg border border-black/10 bg-slate-100 px-3 py-2 text-sm text-[#0f172a] outline-none dark:border-white/[0.08] dark:bg-[#111520] dark:text-[#eef2ff]"
          >
            <option value="all">Alle</option>
            <option value="apartments">Apartments</option>
            <option value="coliving">Co-Living</option>
          </select>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-[11px] font-medium text-[#64748b] dark:text-[#6b7a9a]">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-lg border border-black/10 bg-slate-100 px-3 py-2 text-sm text-[#0f172a] outline-none dark:border-white/[0.08] dark:bg-[#111520] dark:text-[#eef2ff]"
          >
            <option value="all">Alle</option>
            <option value="occupied">Belegt</option>
            <option value="vacant">Leerstand</option>
            <option value="notice">Gekündigt</option>
            <option value="landlord_ended">Vertrag beendet</option>
          </select>
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-[11px] font-medium text-[#64748b] dark:text-[#6b7a9a]">
            Ort
          </label>
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="w-full rounded-lg border border-black/10 bg-slate-100 px-3 py-2 text-sm text-[#0f172a] outline-none dark:border-white/[0.08] dark:bg-[#111520] dark:text-[#eef2ff]"
          >
            <option value="all">Alle</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {total === 0 ? (
        <p className="rounded-[10px] border border-black/10 bg-slate-100 px-4 py-6 text-sm text-[#64748b] dark:border-white/[0.08] dark:bg-[#111520] dark:text-[#6b7a9a]">
          Keine Einheiten vorhanden.
        </p>
      ) : plotted === 0 ? (
        <p className="rounded-[10px] border border-black/10 bg-slate-100 px-4 py-6 text-sm text-[#64748b] dark:border-white/[0.08] dark:bg-[#111520] dark:text-[#6b7a9a]">
          Für diese Einheiten sind noch keine Koordinaten vorhanden. Bitte pflegen Sie die
          Koordinaten an der zugehörigen Liegenschaft (Admin → Liegenschaften).
        </p>
      ) : plottedItems.length === 0 && hasActiveFilters ? (
        <p className="rounded-[10px] border border-black/10 bg-slate-100 px-4 py-6 text-sm text-[#64748b] dark:border-white/[0.08] dark:bg-[#111520] dark:text-[#6b7a9a]">
          Keine Marker passen zu den aktuellen Filtern.
        </p>
      ) : (
        <>
          {missing > 0 && !hasActiveFilters ? (
            <p className="mb-3 text-sm text-[#64748b] dark:text-[#6b7a9a]">
              {missing} Einheiten haben noch keine Koordinaten und werden derzeit nicht auf der
              Karte angezeigt.
            </p>
          ) : null}
          <div
            className="overflow-hidden rounded-[12px] border border-black/10 dark:border-white/[0.08] [&_.leaflet-container]:bg-slate-200 [&_.leaflet-container]:dark:bg-[#0f1219]"
            style={{ height: 380 }}
          >
            <MapContainer
              center={defaultMapCenter}
              zoom={defaultMapZoom}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <PortfolioMapFitBounds items={plottedItems} />
              {plottedItems.map((it) => {
                const style = portfolioMapCircleStyle(it.map_status);
                const isActive = activeUnitId === it.unit_id;
                return (
                  <CircleMarker
                    key={it.unit_id}
                    center={[Number(it.latitude), Number(it.longitude)]}
                    radius={isActive ? 13 : 10}
                    pathOptions={{
                      ...style,
                      fillOpacity: isActive ? 1 : 0.88,
                      weight: isActive ? 3 : 2,
                    }}
                    eventHandlers={{
                      click: () => setActiveUnitId(it.unit_id),
                    }}
                  >
                    <Popup
                      eventHandlers={{
                        remove: () => setActiveUnitId(null),
                      }}
                    >
                      <PortfolioMapPopupBody it={it} />
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </>
      )}
    </SectionCard>
  );
}
