/**
 * SPIKE ONLY — Google Maps + MarkerClusterer feasibility (does not replace PortfolioMapSection).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

const DEFAULT_CENTER = { lat: 46.8, lng: 8.2 };
const DEFAULT_ZOOM = 7;

function statusFill(mapStatus) {
  switch (mapStatus) {
    case "occupied":
      return "#22c55e";
    case "vacant":
      return "#ef4444";
    case "notice":
      return "#f59e0b";
    case "landlord_ended":
      return "#6b7280";
    default:
      return "#94a3b8";
  }
}

function SinglePopupBody({ unit }) {
  const title =
    String(unit.title || "").trim() ||
    String(unit.short_unit_id || unit.unit_id || "").trim() ||
    "—";
  const city = String(unit.city || "").trim();
  return (
    <div className="min-w-[200px] max-w-[260px] space-y-1 p-0.5 text-[13px] leading-snug text-slate-900 dark:text-[#eef2ff]">
      <p className="font-semibold">{title}</p>
      <p className="text-[12px] text-slate-600 dark:text-[#9aaccc]">
        {String(unit.map_status_label || unit.map_status || "—")}
      </p>
      {city ? (
        <p className="text-[12px] text-slate-500 dark:text-[#8b9ab8]">{city}</p>
      ) : null}
      <Link
        to={`/admin/units/${encodeURIComponent(unit.unit_id)}`}
        className="inline-block pt-1 text-sky-600 underline decoration-sky-600/40 underline-offset-2 dark:text-sky-400"
      >
        Einheit öffnen
      </Link>
    </div>
  );
}

function ClusterPopupBody({ units }) {
  return (
    <div className="max-h-[min(280px,60vh)] max-w-[280px] overflow-y-auto pr-0.5 text-[13px] text-slate-900 dark:text-[#eef2ff]">
      <p className="mb-2 text-[12px] font-semibold text-slate-700 dark:text-[#c8d4f0]">
        {units.length} Einheiten (Cluster)
      </p>
      <ul className="space-y-2">
        {units.map((u) => (
          <li
            key={u.unit_id}
            className="rounded-md border border-black/10 bg-white/80 p-2 dark:border-white/[0.08] dark:bg-[#141824]/95"
          >
            <div className="font-medium">
              {String(u.short_unit_id || u.unit_id || "—")} ·{" "}
              <span className="text-[12px] font-normal text-slate-600 dark:text-[#9aaccc]">
                {String(u.map_status_label || u.map_status || "—")}
              </span>
            </div>
            {u.city ? (
              <p className="text-[11px] text-slate-500 dark:text-[#8b9ab8]">{u.city}</p>
            ) : null}
            <Link
              to={`/admin/units/${encodeURIComponent(u.unit_id)}`}
              className="mt-1 inline-block text-[12px] font-medium text-sky-600 underline dark:text-sky-400"
            >
              Einheit öffnen
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SpikeMarkers({ plottedItems, setSingle, setCluster, clearPopups }) {
  const map = useMap();
  const loaded = useApiIsLoaded();
  const clustererRef = useRef(null);
  const markersRef = useRef([]);

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
    clearPopups();

    if (!plottedItems.length) return;

    const SymbolPath = globalThis.google.maps.SymbolPath;
    const markers = plottedItems.map((it) => {
      const fill = statusFill(it.map_status);
      const marker = new globalThis.google.maps.Marker({
        position: {
          lat: Number(it.latitude),
          lng: Number(it.longitude),
        },
        map: null,
        icon: {
          path: SymbolPath.CIRCLE,
          fillColor: fill,
          fillOpacity: 0.92,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 10,
        },
        zIndex: 1,
      });
      marker.set("portfolioUnit", it);
      marker.addListener("click", () => {
        const pos = marker.getPosition();
        if (!pos) return;
        setCluster(null);
        setSingle({
          unit: it,
          position: { lat: pos.lat(), lng: pos.lng() },
        });
      });
      return marker;
    });
    markersRef.current = markers;

    const clusterer = new MarkerClusterer({
      map,
      markers,
      onClusterClick: (_event, c) => {
        setSingle(null);
        const units = c.markers
          .map((m) => m.get("portfolioUnit"))
          .filter(Boolean);
        const p = c.position;
        setCluster({
          position: { lat: p.lat(), lng: p.lng() },
          units,
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
  }, [loaded, map, plottedItems, setSingle, setCluster, clearPopups]);

  useEffect(() => {
    if (!loaded || !map || !plottedItems.length) return;
    const bounds = new globalThis.google.maps.LatLngBounds();
    plottedItems.forEach((it) => {
      bounds.extend({
        lat: Number(it.latitude),
        lng: Number(it.longitude),
      });
    });
    map.fitBounds(bounds, { top: 36, right: 36, bottom: 36, left: 36 });
  }, [loaded, map, plottedItems]);

  return null;
}

function SpikeMapInner({ plottedItems }) {
  const [single, setSingle] = useState(null);
  const [cluster, setCluster] = useState(null);

  const clearPopups = useCallback(() => {
    setSingle(null);
    setCluster(null);
  }, []);

  return (
    <Map
      id="portfolio-google-spike-map"
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={DEFAULT_ZOOM}
      gestureHandling="greedy"
      colorScheme={ColorScheme.DARK}
      renderingType="VECTOR"
      style={{ width: "100%", height: "100%" }}
      disableDefaultUI={false}
      mapTypeControl={false}
    >
      <SpikeMarkers
        plottedItems={plottedItems}
        setSingle={setSingle}
        setCluster={setCluster}
        clearPopups={clearPopups}
      />
      {single ? (
        <InfoWindow position={single.position} onCloseClick={clearPopups}>
          <SinglePopupBody unit={single.unit} />
        </InfoWindow>
      ) : null}
      {cluster ? (
        <InfoWindow position={cluster.position} onCloseClick={clearPopups}>
          <ClusterPopupBody units={cluster.units} />
        </InfoWindow>
      ) : null}
    </Map>
  );
}

export default function PortfolioMapGoogleSpike() {
  const apiKey = (process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "").trim();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const plottedItems = useMemo(() => {
    const items = data?.items;
    if (!Array.isArray(items)) return [];
    return items.filter(
      (it) =>
        it &&
        it.has_coordinates &&
        it.latitude != null &&
        it.longitude != null
    );
  }, [data?.items]);

  const summary = data?.summary || {};
  const total = Number(summary.total_units) || 0;
  const plotted = Number(summary.plotted_units) || 0;

  if (!apiKey) {
    return (
      <div className="rounded-[14px] border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
        <p className="font-semibold">Spike: fehlender API-Key</p>
        <p className="mt-1 text-[13px] opacity-90">
          Setzen Sie <code className="rounded bg-black/10 px-1">REACT_APP_GOOGLE_MAPS_API_KEY</code> in{" "}
          <code className="rounded bg-black/10 px-1">.env</code> und starten Sie den Dev-Server neu.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <p className="py-6 text-sm text-[#64748b] dark:text-[#6b7a9a]">Karte wird geladen…</p>
    );
  }

  if (error) {
    return <p className="py-4 text-sm text-[#f87171]">{error}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#64748b] dark:text-[#6b7a9a]">
        Spike · {total} Einheiten · {plotted} mit Koordinaten (API) · {plottedItems.length} Marker gerendert
      </p>
      {plottedItems.length === 0 ? (
        <p className="rounded-[10px] border border-black/10 bg-slate-100 px-4 py-6 text-sm text-[#64748b] dark:border-white/[0.08] dark:bg-[#111520] dark:text-[#6b7a9a]">
          Keine Einheiten mit Koordinaten — nichts auf der Karte darstellbar.
        </p>
      ) : (
        <div
          className="overflow-hidden rounded-[12px] border border-black/10 dark:border-white/[0.08]"
          style={{ height: 420 }}
        >
          <APIProvider apiKey={apiKey} language="de" region="CH">
            <SpikeMapInner plottedItems={plottedItems} />
          </APIProvider>
        </div>
      )}
    </div>
  );
}
