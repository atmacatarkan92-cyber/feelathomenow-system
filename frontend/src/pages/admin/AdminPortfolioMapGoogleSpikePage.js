import React from "react";
import { Link } from "react-router-dom";
import PortfolioMapGoogleSpike from "../../components/admin/PortfolioMapGoogleSpike";

/**
 * SPIKE ONLY — Google Maps feasibility (does not replace /admin/portfolio-map).
 */
export default function AdminPortfolioMapGoogleSpikePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="m-0 text-[22px] font-bold text-[#0f172a] dark:text-[#eef2ff]">
          Portfolio-Karte (Google — Spike)
        </h1>
        <p className="mt-1 text-sm text-[#64748b] dark:text-[#6b7a9a]">
          Technischer Test: gleiche API-Daten wie die Produktionskarte, nur Rendering mit Google Maps.
        </p>
        <p className="mt-2 text-[13px] text-[#64748b] dark:text-[#6b7a9a]">
          <Link
            to="/admin/portfolio-map"
            className="font-medium text-sky-600 underline underline-offset-2 dark:text-sky-400"
          >
            Zur Leaflet Portfolio-Karte (Produktion)
          </Link>
        </p>
      </div>
      <PortfolioMapGoogleSpike />
    </div>
  );
}
