/**
 * Global portfolio map: all unit types, unit-first / property-fallback coordinates, client-side filters.
 * Renders with Google Maps (@vis.gl/react-google-maps + @googlemaps/markerclusterer).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import {
  APIProvider,
  ColorScheme,
  InfoWindow,
  Map,
  useApiIsLoaded,
  useMap,
} from "@vis.gl/react-google-maps";

import { fetchAdminPortfolioMap, sanitizeClientErrorMessage } from "../../api/adminData";
import { normalizeUnitTypeLabel } from "../../utils/unitDisplayId";

/** Portfolio map filter query keys (namespaced; avoids clashes on Unternehmensübersicht). */
const PM_QS_TYPE = "pm_type";
const PM_QS_STATUS = "pm_status";
const PM_QS_CITY = "pm_city";

const PM_VALID_TYPES = new Set(["all", "apartments", "coliving"]);
const PM_VALID_STATUSES = new Set([
  "all",
  "occupied",
  "vacant",
  "notice",
  "landlord_ended",
]);

const DEFAULT_CENTER = { lat: 46.8, lng: 8.2 };
const DEFAULT_ZOOM = 7;

/** Stable references — @vis.gl InfoWindow re-runs open/close effect when pixelOffset identity changes; inline arrays cause close on every parent re-render (e.g. cluster list hover). */
const PORTFOLIO_MAP_IW_PIXEL_OFFSET_SINGLE = Object.freeze([0, -14]);
const PORTFOLIO_MAP_IW_PIXEL_OFFSET_CLUSTER = Object.freeze([0, -10]);

/** Google Maps dark basemap (portfolio map visual only). */
const PORTFOLIO_MAP_DARK_STYLES = Object.freeze([
  { elementType: "geometry", stylers: [{ color: "#0d1018" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#2a3250" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d1018" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a2038" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1e2840" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1525" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#1e2738" }] },
]);

/**
 * Cluster list sort: operational priority (backend map_status today: vacant | notice | occupied | landlord_ended).
 * "reserved" ranked for forward compatibility if ever added to map payloads.
 */
const PORTFOLIO_MAP_STATUS_SORT_RANK = {
  vacant: 0,
  notice: 1,
  reserved: 2,
  occupied: 3,
  landlord_ended: 4,
};

function portfolioMapClusterSortUnits(a, b) {
  const ra = PORTFOLIO_MAP_STATUS_SORT_RANK[a.map_status] ?? 99;
  const rb = PORTFOLIO_MAP_STATUS_SORT_RANK[b.map_status] ?? 99;
  if (ra !== rb) return ra - rb;
  const sa = String(a.short_unit_id || a.unit_id || "");
  const sb = String(b.short_unit_id || b.unit_id || "");
  return sa.localeCompare(sb, "de-CH");
}

/** Marker/cluster click may be MapMouseEvent or legacy DOM event; stop map from treating it as a map click (closes InfoWindow). */
function portfolioMapStopMapMouseEvent(event) {
  if (!event) return;
  try {
    if (typeof event.stop === "function") event.stop();
  } catch {
    /* ignore */
  }
  const raw = event.domEvent != null ? event.domEvent : event;
  if (raw && typeof raw.stopPropagation === "function") raw.stopPropagation();
  if (raw && typeof raw.preventDefault === "function") raw.preventDefault();
}

/** Marker status colors (map pins / UI — visual palette). */
function portfolioMapMarkerFill(mapStatus) {
  switch (mapStatus) {
    case "occupied":
      return "#4ade80";
    case "vacant":
      return "#f87171";
    case "notice":
      return "#fbbf24";
    case "landlord_ended":
      return "#6b7280";
    default:
      return "#94a3b8";
  }
}

function portfolioMapMarkerPinBackdrop(mapStatus) {
  switch (mapStatus) {
    case "occupied":
      return "#0d2218";
    case "vacant":
      return "#1a0808";
    case "notice":
      return "#1a1500";
    case "landlord_ended":
      return "#141824";
    default:
      return "#141824";
  }
}

function portfolioMapPinLabelAbbrev(mapStatus) {
  switch (mapStatus) {
    case "occupied":
      return "BL";
    case "vacant":
      return "FR";
    case "notice":
      return "BF";
    case "landlord_ended":
      return "VB";
    default:
      return "—";
  }
}

function SectionCard({ title, subtitle, children, rightSlot = null, hideHeader = false }) {
  return (
    <div className="rounded-[14px] border border-[#1e2130] bg-[#11131a] p-5">
      {!hideHeader ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[#c5cbe0]">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-[#6b7a9a]">{subtitle}</p>
            ) : null}
          </div>
          {rightSlot}
        </div>
      ) : null}
      {children}
    </div>
  );
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

function portfolioMapCoLivingOccSummary(it) {
  if (!isCoLivingType(it.type)) return null;
  const rooms = Number(it.rooms);
  if (!(rooms > 0)) return null;
  const occ = Number(it.occupied_rooms ?? 0);
  return `${occ} / ${rooms} belegt`;
}

function portfolioMapLocationHint(it) {
  const a = String(it.address || "").trim();
  if (a) return a;
  const city = String(it.city || "").trim();
  const postal = String(it.postal_code || "").trim();
  const pc = [postal, city].filter(Boolean).join(" ");
  return pc || "";
}

function portfolioMapClusterSecondaryLine(it) {
  const occ = portfolioMapCoLivingOccSummary(it);
  if (occ) return occ;
  return String(it.map_status_label || "").trim() || "—";
}

function PortfolioMapUnitTypeBadge({ apiType }) {
  const label = portfolioMapTypeLabel(apiType);
  return (
    <span className="inline-flex max-w-full shrink-0 items-center rounded-[20px] border border-[#1e2738] bg-[#181c28] px-2 py-0.5 text-[10px] font-semibold leading-none text-[#c5cbe0]">
      {label}
    </span>
  );
}

/** Stops map from receiving clicks (closes InfoWindow); bubble phase so buttons/links still work. */
function PortfolioMapInfowindowChrome({ children }) {
  return (
    <div
      className="pointer-events-auto max-w-[min(360px,92vw)] select-text rounded-[12px] border border-[#2a3250] bg-[#181c28] p-4 text-[13px] leading-snug text-[#c5cbe0] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function PortfolioClusterListContent({ units, onOpenUnit, onHoverUnit }) {
  const headCls = "mb-3 border-b border-[#1e2130] pb-3";
  const titleCls = "text-[14px] font-bold leading-tight text-[#c5cbe0]";
  const cardCls =
    "rounded-[10px] border border-[#1e2738] bg-[#181c28] p-3 transition-colors hover:border-[#2a3250] hover:bg-[#1d2235]";
  const idCls = "font-semibold text-[#c5cbe0]";
  const secCls = "text-[12px] font-medium text-[#c5cbe0]";
  const locCls = "mt-1 text-[11px] text-[#4b5563]";
  const btnCls =
    "mt-2 w-full cursor-pointer rounded-md border border-[#3b5fcf]/40 bg-[#1a2140]/50 px-2 py-2 text-left text-[12px] font-semibold text-[#60a5fa] transition-colors hover:border-[#5b8cf8]/60 hover:bg-[#1a2140]";

  return (
    <PortfolioMapInfowindowChrome>
      <div className={headCls}>
        <p className={titleCls}>{units.length} Einheiten an diesem Standort</p>
      </div>
      <div className="max-h-[min(260px,55vh)] overflow-y-auto overscroll-contain pr-0.5">
        <ul className="space-y-2.5">
          {units.map((it) => {
            const loc = portfolioMapLocationHint(it);
            const shortId = String(it.short_unit_id || it.unit_id || "").trim() || "—";
            return (
              <li
                key={it.unit_id}
                data-portfolio-map-unit={it.unit_id}
                className={cardCls}
                onMouseEnter={() => onHoverUnit?.(it.unit_id)}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={idCls}>{shortId}</span>
                  <span className="text-[#4b5563]" aria-hidden>
                    ·
                  </span>
                  <span className={secCls}>{portfolioMapClusterSecondaryLine(it)}</span>
                  <PortfolioMapUnitTypeBadge apiType={it.type} />
                </div>
                {loc ? <p className={locCls}>{loc}</p> : null}
                <button
                  type="button"
                  className={btnCls}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenUnit(it.unit_id);
                  }}
                >
                  Einheit öffnen
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </PortfolioMapInfowindowChrome>
  );
}

/** Cluster count badge (dark map). */
const portfolioMapClusterRenderer = {
  render(cluster, _stats, _map) {
    const count = cluster.count;
    const position = cluster.position;
    const fid = `pmc_${count}_${Math.round(position.lat() * 1e5)}_${Math.round(position.lng() * 1e5)}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>
        <filter id="${fid}" x="-45%" y="-45%" width="190%" height="190%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.55"/>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="32" fill="#11131a" stroke="#1e2130" stroke-width="2.5" filter="url(#${fid})"/>
      <circle cx="50" cy="50" r="27" fill="#181c28" stroke="#2a3250" stroke-width="2"/>
      <text x="50" y="59" text-anchor="middle" font-size="20" font-weight="800" fill="#c5cbe0" font-family="ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace">${count}</text>
    </svg>`;
    return new globalThis.google.maps.Marker({
      position,
      cursor: "pointer",
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new globalThis.google.maps.Size(54, 54),
        anchor: new globalThis.google.maps.Point(27, 27),
      },
      zIndex: Number(globalThis.google.maps.Marker.MAX_ZINDEX) + count,
      title: `${count} Einheiten`,
    });
  },
};

/**
 * Property-style pin: dark pin body, pulsing status dot, label pill (visual only).
 */
function buildPropertyMarkerIcon(it, activeUnitId, hoverUnitId) {
  const fill = portfolioMapMarkerFill(it.map_status);
  const backdrop = portfolioMapMarkerPinBackdrop(it.map_status);
  const abbrev = portfolioMapPinLabelAbbrev(it.map_status);
  const uid = it.unit_id;
  const active = activeUnitId === uid;
  const hover = hoverUnitId === uid;
  const rid = `pmp_${String(uid).replace(/\W/g, "_").slice(0, 40)}`;
  const scale = active ? 1.08 : hover ? 1.04 : 1;
  const ring = active
    ? `<circle cx="24" cy="19" r="20" fill="none" stroke="#3b5fcf" stroke-width="2" opacity="0.9"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 70" width="48" height="70">
    <defs>
      <filter id="${rid}_sh" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <g transform="translate(24 22) scale(${scale}) translate(-24 -22)" filter="url(#${rid}_sh)">
      ${ring}
      <path d="M24 3C14.06 3 7 10.06 7 19c0 10.5 17 31 17 31s17-20.5 17-31C41 10.06 33.94 3 24 3z" fill="${backdrop}" stroke="${fill}" stroke-width="2.5"/>
      <circle cx="24" cy="19" r="7.5" fill="${fill}" stroke="#0d1018" stroke-width="1">
        <animate attributeName="opacity" values="0.72;1;0.72" dur="1.6s" repeatCount="indefinite"/>
      </circle>
      <rect x="20" y="22" width="8" height="9" rx="1" fill="#0d1018" opacity="0.45"/>
    </g>
    <rect x="7" y="52" width="34" height="15" rx="7.5" fill="#181c28" stroke="#1e2738" stroke-width="1"/>
    <text x="24" y="63" text-anchor="middle" font-size="9" font-weight="800" fill="${fill}" font-family="system-ui,sans-serif">${abbrev}</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new globalThis.google.maps.Size(44, 64),
    anchor: new globalThis.google.maps.Point(22, 62),
  };
}

function PortfolioMapMarkersAndCluster({
  plottedItems,
  plottedItemsKey,
  preview,
  activeUnitId,
  clusterListHoverUnitId,
  onUnitMarkerClick,
  onSinglePopupClose,
  onClusterPopupClose,
  onHoverUnit,
  onHoverClear,
}) {
  const map = useMap();
  const loaded = useApiIsLoaded();
  const clustererRef = useRef(null);
  const markersRef = useRef([]);
  const navigate = useNavigate();

  const [singleInfo, setSingleInfo] = useState(null);
  const [clusterInfo, setClusterInfo] = useState(null);

  const iwStyleSingle = useMemo(() => ({ padding: 0, maxWidth: 300 }), []);
  const iwStyleCluster = useMemo(() => ({ padding: 0, maxWidth: 384 }), []);

  const handleClusterOpenUnit = useCallback(
    (unitId) => {
      setClusterInfo(null);
      onClusterPopupClose();
      navigate(`/admin/units/${encodeURIComponent(unitId)}`);
    },
    [navigate, onClusterPopupClose]
  );

  const clearPopups = useCallback(() => {
    setSingleInfo(null);
    setClusterInfo(null);
    onSinglePopupClose();
    onClusterPopupClose();
  }, [onSinglePopupClose, onClusterPopupClose]);

  const closeSinglePopup = useCallback(() => {
    setSingleInfo(null);
    onSinglePopupClose();
  }, [onSinglePopupClose]);

  const closeClusterPopup = useCallback(() => {
    setClusterInfo(null);
    onClusterPopupClose();
  }, [onClusterPopupClose]);

  useEffect(() => {
    clearPopups();
    onHoverClear();
  }, [plottedItemsKey, clearPopups, onHoverClear]);

  useEffect(() => {
    if (!loaded || !map || !globalThis.google?.maps) return;

    markersRef.current.forEach((m) => {
      globalThis.google.maps.event.clearInstanceListeners(m);
      m.setMap(null);
    });
    markersRef.current = [];
    if (clustererRef.current) {
      clustererRef.current.setMap(null);
      clustererRef.current = null;
    }

    if (!plottedItems.length) return;

    const markers = plottedItems.map((it) => {
      const marker = new globalThis.google.maps.Marker({
        position: {
          lat: Number(it.latitude),
          lng: Number(it.longitude),
        },
        map: null,
        icon: buildPropertyMarkerIcon(it, null, null),
        cursor: preview ? undefined : "pointer",
        zIndex: 1,
      });
      marker.set("portfolioUnit", it);
      if (!preview) {
        marker.addListener("click", (ev) => {
          portfolioMapStopMapMouseEvent(ev);
          const pos = marker.getPosition();
          if (!pos) return;
          setClusterInfo(null);
          onClusterPopupClose();
          onUnitMarkerClick(it.unit_id);
          setSingleInfo({
            unit: it,
            position: { lat: pos.lat(), lng: pos.lng() },
          });
        });
      }
      return marker;
    });
    markersRef.current = markers;

    const clusterer = new MarkerClusterer({
      map,
      markers,
      renderer: portfolioMapClusterRenderer,
      onClusterClick: preview
        ? () => {}
        : (event, c) => {
            portfolioMapStopMapMouseEvent(event);
            setSingleInfo(null);
            onSinglePopupClose();
            onHoverClear();
            const units = c.markers
              .map((m) => m.get("portfolioUnit"))
              .filter(Boolean);
            const sorted = [...units].sort(portfolioMapClusterSortUnits);
            const p = c.position;
            setClusterInfo({
              position: { lat: p.lat(), lng: p.lng() },
              units: sorted,
            });
          },
    });
    clustererRef.current = clusterer;

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current.setMap(null);
        clustererRef.current = null;
      }
      markersRef.current.forEach((m) => {
        globalThis.google.maps.event.clearInstanceListeners(m);
        m.setMap(null);
      });
      markersRef.current = [];
    };
  }, [
    loaded,
    map,
    plottedItems,
    plottedItemsKey,
    preview,
    onUnitMarkerClick,
    onSinglePopupClose,
    onClusterPopupClose,
    onHoverClear,
  ]);

  useEffect(() => {
    if (!loaded || !globalThis.google?.maps) return;
    markersRef.current.forEach((m) => {
      const it = m.get("portfolioUnit");
      if (!it) return;
      m.setIcon(buildPropertyMarkerIcon(it, activeUnitId, clusterListHoverUnitId));
      m.setZIndex(
        activeUnitId === it.unit_id ? 200 : clusterListHoverUnitId === it.unit_id ? 80 : 1
      );
    });
  }, [loaded, activeUnitId, clusterListHoverUnitId]);

  useEffect(() => {
    if (!loaded || !map || !plottedItems.length) return;
    if (plottedItems.length === 1) {
      const it = plottedItems[0];
      map.setCenter({
        lat: Number(it.latitude),
        lng: Number(it.longitude),
      });
      map.setZoom(14);
      return;
    }
    const bounds = new globalThis.google.maps.LatLngBounds();
    plottedItems.forEach((it) => {
      bounds.extend({
        lat: Number(it.latitude),
        lng: Number(it.longitude),
      });
    });
    map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
    globalThis.google.maps.event.addListenerOnce(map, "bounds_changed", () => {
      const z = map.getZoom();
      if (z != null && z > 15) map.setZoom(15);
    });
  }, [loaded, map, plottedItems]);

  return (
    <>
      {!preview && singleInfo ? (
        <InfoWindow
          position={singleInfo.position}
          shouldFocus={false}
          disableAutoPan
          pixelOffset={PORTFOLIO_MAP_IW_PIXEL_OFFSET_SINGLE}
          className="portfolio-map-iw"
          style={iwStyleSingle}
          onClose={closeSinglePopup}
          onCloseClick={closeSinglePopup}
        >
          <PortfolioMapPopupBody it={singleInfo.unit} />
        </InfoWindow>
      ) : null}
      {!preview && clusterInfo ? (
        <InfoWindow
          position={clusterInfo.position}
          shouldFocus={false}
          disableAutoPan
          pixelOffset={PORTFOLIO_MAP_IW_PIXEL_OFFSET_CLUSTER}
          className="portfolio-map-iw"
          style={iwStyleCluster}
          onClose={closeClusterPopup}
          onCloseClick={closeClusterPopup}
        >
          <PortfolioClusterListContent
            units={clusterInfo.units}
            onOpenUnit={handleClusterOpenUnit}
            onHoverUnit={onHoverUnit}
          />
        </InfoWindow>
      ) : null}
    </>
  );
}

function portfolioMapPopupStatusBadgeClasses(mapStatus) {
  switch (mapStatus) {
    case "occupied":
      return "border border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.1)] text-[#4ade80]";
    case "notice":
      return "border border-[rgba(251,191,36,0.2)] bg-[rgba(251,191,36,0.1)] text-[#fbbf24]";
    case "vacant":
      return "border border-[rgba(248,113,113,0.2)] bg-[rgba(248,113,113,0.1)] text-[#f87171]";
    default:
      return "border border-[#1e2738] bg-[#181c28] text-[#94a3b8]";
  }
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

  const coLivingExtra = portfolioMapCoLivingOccSummary(it);
  const coLiving = isCoLivingType(it.type);

  const addressLine = String(it.address || "").trim();
  const postal = String(it.postal_code || "").trim();
  const postalCity = [postal, city].filter(Boolean).join(" ");

  const badgeCls = `inline-flex max-w-full items-center rounded-[20px] px-2 py-0.5 text-[10px] font-semibold ${portfolioMapPopupStatusBadgeClasses(it.map_status)}`;

  return (
    <PortfolioMapInfowindowChrome>
      <div className="min-w-[220px] max-w-[280px] space-y-3">
        <p className="text-[15px] font-bold leading-snug text-[#c5cbe0]">{line1}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <PortfolioMapUnitTypeBadge apiType={it.type} />
        </div>
        {coLivingExtra ? (
          <div className="rounded-[10px] border border-[#1e2130] bg-[#141824] px-3 py-2">
            {coLiving ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#4b5563]">Belegung</p>
            ) : null}
            <p className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums text-[#c5cbe0]">{coLivingExtra}</p>
          </div>
        ) : null}
        <div className="border-t border-[#1e2130] pt-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[#4b5563]">Status</p>
          <span className={`mt-1.5 ${badgeCls}`}>{it.map_status_label}</span>
        </div>
        {addressLine ? (
          <div className="border-t border-[#1e2130] pt-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[#4b5563]">Adresse</p>
            <p className="mt-1 font-mono text-[12px] leading-snug text-[#c5cbe0]">{addressLine}</p>
          </div>
        ) : null}
        {postalCity ? (
          <p className="font-mono text-[12px] text-[#c5cbe0]">{postalCity}</p>
        ) : null}
        <Link
          to={`/admin/units/${encodeURIComponent(it.unit_id)}`}
          className="mt-1 inline-flex w-full cursor-pointer items-center justify-center rounded-[10px] border border-[#3b5fcf]/40 bg-[#1a2140]/60 px-3 py-2.5 text-[12px] font-semibold text-[#60a5fa] transition-colors hover:border-[#5b8cf8]/55 hover:bg-[#1a2140]"
          onClick={(e) => e.stopPropagation()}
        >
          Einheit öffnen
        </Link>
      </div>
    </PortfolioMapInfowindowChrome>
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

function PortfolioMapGoogleInner({
  plottedItems,
  plottedItemsKey,
  preview,
  activeUnitId,
  clusterListHoverUnitId,
  setActiveUnitId,
  setClusterListHoverUnitId,
}) {
  const mapId = (process.env.REACT_APP_GOOGLE_MAPS_MAP_ID || "").trim() || undefined;

  const onSinglePopupClose = useCallback(() => {
    setActiveUnitId(null);
  }, [setActiveUnitId]);

  const onClusterPopupClose = useCallback(() => {
    setClusterListHoverUnitId(null);
  }, [setClusterListHoverUnitId]);

  const onHoverClear = useCallback(() => {
    setClusterListHoverUnitId(null);
  }, [setClusterListHoverUnitId]);

  return (
    <Map
      id="portfolio-map-google"
      mapId={mapId}
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={DEFAULT_ZOOM}
      gestureHandling={preview ? "none" : "greedy"}
      colorScheme={ColorScheme.DARK}
      renderingType="VECTOR"
      styles={PORTFOLIO_MAP_DARK_STYLES}
      style={{ width: "100%", height: "100%" }}
      disableDefaultUI={preview}
      mapTypeControl={false}
      scrollwheel={!preview}
    >
      <PortfolioMapMarkersAndCluster
        plottedItems={plottedItems}
        plottedItemsKey={plottedItemsKey}
        preview={preview}
        activeUnitId={activeUnitId}
        clusterListHoverUnitId={clusterListHoverUnitId}
        onUnitMarkerClick={setActiveUnitId}
        onSinglePopupClose={onSinglePopupClose}
        onClusterPopupClose={onClusterPopupClose}
        onHoverUnit={setClusterListHoverUnitId}
        onHoverClear={onHoverClear}
      />
    </Map>
  );
}

export default function PortfolioMapSection({
  preview = false,
  hideSectionHeader = false,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [clusterListHoverUnitId, setClusterListHoverUnitId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const apiKey = (process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "").trim();

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

  const cityOptions = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const s = new Set();
    for (const it of items) {
      const c = String(it?.city || "").trim();
      if (c) s.add(c);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "de-CH"));
  }, [items]);

  const filterType = useMemo(() => {
    if (preview) return "all";
    const v = searchParams.get(PM_QS_TYPE);
    return PM_VALID_TYPES.has(v) ? v : "all";
  }, [preview, searchParams]);

  const filterStatus = useMemo(() => {
    if (preview) return "all";
    const v = searchParams.get(PM_QS_STATUS);
    return PM_VALID_STATUSES.has(v) ? v : "all";
  }, [preview, searchParams]);

  const filterCityParam = preview ? null : searchParams.get(PM_QS_CITY);

  const filterCity = useMemo(() => {
    if (preview) return "all";
    if (!filterCityParam || filterCityParam === "all") return "all";
    if (cityOptions.length === 0) return filterCityParam;
    return cityOptions.includes(filterCityParam) ? filterCityParam : "all";
  }, [preview, filterCityParam, cityOptions]);

  useEffect(() => {
    if (preview) return;
    if (!filterCityParam || filterCityParam === "all") return;
    if (cityOptions.length === 0) return;
    if (!cityOptions.includes(filterCityParam)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(PM_QS_CITY);
          return next;
        },
        { replace: true }
      );
    }
  }, [preview, filterCityParam, cityOptions, setSearchParams]);

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

  const plottedItemsKey = useMemo(
    () => plottedItems.map((x) => x.unit_id).join("|"),
    [plottedItems]
  );

  const hasActiveFilters =
    filterType !== "all" || filterStatus !== "all" || filterCity !== "all";

  const mapHeightPx = preview ? 200 : 380;
  const sectionHideHeader = hideSectionHeader && !preview;

  if (loading) {
    return (
      <SectionCard
        hideHeader={sectionHideHeader}
        title="Portfolio-Karte"
        subtitle={
          preview
            ? "Vorschau · Klicken Sie für die interaktive Karte"
            : "Globale Übersicht aller Einheiten · Standorte aus Liegenschaftskoordinaten"
        }
      >
        <p className="py-8 text-sm text-[#94a3b8]">Karte wird geladen…</p>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard
        hideHeader={sectionHideHeader}
        title="Portfolio-Karte"
        subtitle={
          preview
            ? "Vorschau · Klicken Sie für die interaktive Karte"
            : "Globale Übersicht aller Einheiten · Standorte aus Liegenschaftskoordinaten"
        }
      >
        <p className="py-4 text-sm text-[#f87171]">{error}</p>
        {preview ? (
          <Link
            to="/admin/portfolio-map"
            className="mt-3 inline-flex rounded-[7px] border border-[#1e2738] bg-[#181c28] px-4 py-2 text-sm font-semibold text-[#c5cbe0] no-underline transition-colors hover:border-[#2a3250] hover:bg-[#1d2235]"
          >
            Portfolio-Karte öffnen
          </Link>
        ) : null}
      </SectionCard>
    );
  }

  const summary = data?.summary || {};
  const total = Number(summary.total_units) || 0;
  const plotted = Number(summary.plotted_units) || 0;
  const missing = Number(summary.missing_coordinates) || 0;

  const mapShellClass =
    "overflow-hidden rounded-[12px] border border-[#1e2130] bg-[#0d1018] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

  const mapBlock = (
    <div
      className={preview ? `${mapShellClass} pointer-events-none` : `${mapShellClass} relative`}
      style={{ height: mapHeightPx }}
    >
      {!apiKey ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[#fbbf24]">
          <div className="max-w-md rounded-[10px] border border-[#fbbf24]/30 bg-[#1a1500]/40 p-4">
            <p className="font-semibold text-[#c5cbe0]">Kartenansicht nicht verfügbar</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[#94a3b8]">
              Für die Karte wird <code className="rounded bg-[#181c28] px-1 text-[#c5cbe0]">REACT_APP_GOOGLE_MAPS_API_KEY</code> in der
              Frontend-Konfiguration benötigt (Maps JavaScript API). Bitte Schlüssel setzen und Anwendung neu starten.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="h-full w-full">
            <APIProvider apiKey={apiKey} language="de" region="CH">
              <PortfolioMapGoogleInner
                plottedItems={plottedItems}
                plottedItemsKey={plottedItemsKey}
                preview={preview}
                activeUnitId={activeUnitId}
                clusterListHoverUnitId={clusterListHoverUnitId}
                setActiveUnitId={setActiveUnitId}
                setClusterListHoverUnitId={setClusterListHoverUnitId}
              />
            </APIProvider>
          </div>
          {!preview ? (
            <>
              <div className="pointer-events-none absolute bottom-3 left-3 z-[2] max-w-[200px] rounded-[10px] border border-[#1e2130] bg-[rgba(17,19,26,0.92)] px-4 py-3 text-[11px] text-[#c5cbe0] shadow-lg backdrop-blur-[8px]">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.5px] text-[#4b5563]">Legende</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#4ade80]" />
                    <span>Belegt</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#fbbf24]" />
                    <span>Bald frei</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#f87171]" />
                    <span>Frei</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#6b7280]" />
                    <span>Sonstige</span>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute left-1/2 top-3 z-[2] -translate-x-1/2">
                <div className="flex items-center gap-3 rounded-[20px] border border-[#1e2130] bg-[rgba(17,19,26,0.9)] px-4 py-2 text-[11px] font-medium text-[#c5cbe0] shadow-lg backdrop-blur-sm">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#4ade80]" />
                    <span className="font-mono tabular-nums text-[#4ade80]">
                      {filteredItems.filter((u) => u.map_status === "occupied").length}
                    </span>
                  </span>
                  <span className="text-[#1e2130]">|</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#fbbf24]" />
                    <span className="font-mono tabular-nums text-[#fbbf24]">
                      {filteredItems.filter((u) => u.map_status === "notice").length}
                    </span>
                  </span>
                  <span className="text-[#1e2130]">|</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#f87171]" />
                    <span className="font-mono tabular-nums text-[#f87171]">
                      {filteredItems.filter((u) => u.map_status === "vacant").length}
                    </span>
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <SectionCard
      hideHeader={sectionHideHeader}
      title="Portfolio-Karte"
      subtitle={
        preview
          ? "Vorschau · Klicken Sie für die interaktive Karte mit Filtern"
          : "Alle Einheitstypen · Statusfarben · nur Marker mit Koordinaten an der Liegenschaft"
      }
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
        <aside className="w-full min-w-0 shrink-0 space-y-4 border-[#1e2130] xl:w-[min(100%,380px)] xl:border-r xl:pr-8">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[8px] border border-[#1e2738] bg-[#181c28] px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[#4b5563]">Einheiten</p>
              <p className="mt-1 font-mono text-[18px] font-medium leading-none text-[#4ade80]">{total}</p>
            </div>
            <div className="rounded-[8px] border border-[#1e2738] bg-[#181c28] px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[#4b5563]">Auf Karte</p>
              <p className="mt-1 font-mono text-[18px] font-medium leading-none text-[#fbbf24]">{plotted}</p>
            </div>
            <div className="rounded-[8px] border border-[#1e2738] bg-[#181c28] px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[#4b5563]">Auslastung</p>
              <p className="mt-1 font-mono text-[18px] font-medium leading-none text-[#60a5fa]">
                {total > 0 ? Math.round((plotted / total) * 100) : 0}%
              </p>
            </div>
          </div>

          {!preview && hasActiveFilters && (
            <p className="text-xs text-[#6b7a9a]">
              Nach Filter: {filteredItems.length} Einheiten · {plottedItems.length} Marker
            </p>
          )}

          {!preview ? (
            <div className="flex flex-col gap-3">
              <div className="min-w-0">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.5px] text-[#4b5563]">
                  Typ
                </label>
                <select
                  value={filterType}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev);
                        if (v === "all") next.delete(PM_QS_TYPE);
                        else next.set(PM_QS_TYPE, v);
                        return next;
                      },
                      { replace: true }
                    );
                  }}
                  className="w-full rounded-[7px] border border-[#1e2738] bg-[#181c28] px-3 py-2 text-[13px] text-[#c5cbe0] outline-none focus:border-[#2a3250]"
                >
                  <option value="all">Alle</option>
                  <option value="apartments">Apartments</option>
                  <option value="coliving">Co-Living</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.5px] text-[#4b5563]">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev);
                        if (v === "all") next.delete(PM_QS_STATUS);
                        else next.set(PM_QS_STATUS, v);
                        return next;
                      },
                      { replace: true }
                    );
                  }}
                  className="w-full rounded-[7px] border border-[#1e2738] bg-[#181c28] px-3 py-2 text-[13px] text-[#c5cbe0] outline-none focus:border-[#2a3250]"
                >
                  <option value="all">Alle</option>
                  <option value="occupied">Belegt</option>
                  <option value="vacant">Leerstand</option>
                  <option value="notice">Gekündigt</option>
                  <option value="landlord_ended">Vertrag beendet</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.5px] text-[#4b5563]">
                  Ort
                </label>
                <select
                  value={filterCity}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev);
                        if (v === "all") next.delete(PM_QS_CITY);
                        else next.set(PM_QS_CITY, v);
                        return next;
                      },
                      { replace: true }
                    );
                  }}
                  className="w-full rounded-[7px] border border-[#1e2738] bg-[#181c28] px-3 py-2 text-[13px] text-[#c5cbe0] outline-none focus:border-[#2a3250]"
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
          ) : null}
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
      {total === 0 ? (
        <>
          <p className="rounded-[10px] border border-[#1e2738] bg-[#181c28] px-4 py-6 text-sm text-[#94a3b8]">
            Keine Einheiten vorhanden.
          </p>
          {preview ? (
            <Link
              to="/admin/portfolio-map"
              className="mt-3 inline-flex rounded-[7px] border border-[#1e2738] bg-[#181c28] px-4 py-2 text-sm font-semibold text-[#c5cbe0] no-underline transition-colors hover:border-[#2a3250] hover:bg-[#1d2235]"
            >
              Portfolio-Karte öffnen
            </Link>
          ) : null}
        </>
      ) : plotted === 0 ? (
        <>
          <p className="rounded-[10px] border border-[#1e2738] bg-[#181c28] px-4 py-6 text-sm text-[#94a3b8]">
            {preview
              ? "Noch keine Koordinaten an den Liegenschaften — Details und Pflege auf der Portfolio-Karte."
              : "Für diese Einheiten sind noch keine Koordinaten vorhanden. Bitte pflegen Sie die Koordinaten an der zugehörigen Liegenschaft (Admin → Liegenschaften)."}
          </p>
          {preview ? (
            <Link
              to="/admin/portfolio-map"
              className="mt-3 inline-flex rounded-[7px] border border-[#1e2738] bg-[#181c28] px-4 py-2 text-sm font-semibold text-[#c5cbe0] no-underline transition-colors hover:border-[#2a3250] hover:bg-[#1d2235]"
            >
              Portfolio-Karte öffnen
            </Link>
          ) : null}
        </>
      ) : plottedItems.length === 0 && hasActiveFilters ? (
        <p className="rounded-[10px] border border-[#1e2738] bg-[#181c28] px-4 py-6 text-sm text-[#94a3b8]">
          Keine Marker passen zu den aktuellen Filtern.
        </p>
      ) : (
        <>
          {missing > 0 && !hasActiveFilters && !preview ? (
            <p className="mb-3 text-sm text-[#94a3b8]">
              {missing} Einheiten haben noch keine Koordinaten und werden derzeit nicht auf der
              Karte angezeigt.
            </p>
          ) : null}
          {missing > 0 && !hasActiveFilters && preview ? (
            <p className="mb-3 text-[11px] text-[#94a3b8]">
              {missing} ohne Koordinaten (nicht in der Vorschau).
            </p>
          ) : null}
          {preview ? (
            <>
              <Link
                to="/admin/portfolio-map"
                className="group block rounded-[12px] no-underline outline-none ring-offset-2 ring-offset-[#0d0f14] transition-shadow focus-visible:ring-2 focus-visible:ring-[#3b5fcf]/50"
                aria-label="Zur vollständigen Portfolio-Karte mit Filtern"
              >
                {mapBlock}
              </Link>
              <Link
                to="/admin/portfolio-map"
                className="mt-3 inline-flex rounded-[7px] border border-[#1e2738] bg-[#181c28] px-4 py-2 text-sm font-semibold text-[#c5cbe0] no-underline transition-colors hover:border-[#2a3250] hover:bg-[#1d2235]"
              >
                Portfolio-Karte öffnen
              </Link>
            </>
          ) : (
            mapBlock
          )}
        </>
      )}
        </div>
      </div>
    </SectionCard>
  );
}
