import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchAdminProperties,
  fetchAdminLandlords,
  createAdminProperty,
  updateAdminProperty,
  geocodeAdminProperty,
} from "../../api/adminData";

function geocodingStatusPresentation(meta, snapshot, isCreate) {
  if (isCreate) {
    return {
      text: "Geocoding: Noch nicht berechnet",
      className: "text-[11px] text-[#4a5070]",
    };
  }
  if (meta) {
    if (meta.status === "ok") {
      return {
        text: "Geocoding: Erfolgreich",
        className: "text-[11px] font-medium text-[#3ddc84]",
      };
    }
    if (meta.status === "skipped") {
      if (meta.reason === "unchanged") {
        return {
          text: "Geocoding: Adresse unverändert",
          className: "text-[11px] text-[#4a5070]",
        };
      }
      if (meta.reason === "incomplete_address") {
        return {
          text: "Geocoding: Unvollständig",
          className: "text-[11px] font-medium text-[#f5a623]",
        };
      }
      if (meta.reason === "provider_unavailable") {
        return {
          text: "Geocoding: Nicht verfügbar",
          className: "text-[11px] font-medium text-[#f5a623]",
        };
      }
      return {
        text: "Geocoding: Übersprungen",
        className: "text-[11px] text-[#4a5070]",
      };
    }
    if (meta.status === "failed") {
      return {
        text: "Geocoding: Fehlgeschlagen",
        className: "text-[11px] font-medium text-[#ff5f6d]",
      };
    }
  }
  if (snapshot && snapshot.lat != null && snapshot.lng != null) {
    return {
      text: "Geocoding: Koordinaten vorhanden",
      className: "text-[11px] text-[#3ddc84]",
    };
  }
  return {
    text: "Geocoding: Noch nicht berechnet",
    className: "text-[11px] text-[#4a5070]",
  };
}

const inputClass =
  "w-full rounded-[8px] border border-[#1c2035] bg-[#141720] px-2.5 py-2 text-sm text-[#edf0f7] outline-none";
const labelClass = "mb-1 block text-[10px] font-medium text-[#4a5070]";

function AdminPropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    landlord_id: "",
    title: "",
    street: "",
    house_number: "",
    zip_code: "",
    city: "",
    country: "CH",
    status: "active",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [lastGeocodingMeta, setLastGeocodingMeta] = useState(null);
  const [coordinateSnapshot, setCoordinateSnapshot] = useState(null);
  const [geocodingRetrying, setGeocodingRetrying] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([fetchAdminProperties(), fetchAdminLandlords()])
      .then(([props, lords]) => {
        setProperties(props);
        setLandlords(lords || []);
      })
      .catch((e) => setError(e.message || "Fehler beim Laden."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setLastGeocodingMeta(null);
    setCoordinateSnapshot(null);
    setForm({
      landlord_id: "",
      title: "",
      street: "",
      house_number: "",
      zip_code: "",
      city: "",
      country: "CH",
      status: "active",
      notes: "",
    });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setLastGeocodingMeta(null);
    setCoordinateSnapshot(
      row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : { lat: null, lng: null }
    );
    setForm({
      landlord_id: row.landlord_id || "",
      title: row.title || "",
      street: row.street || "",
      house_number: row.house_number || "",
      zip_code: row.zip_code || "",
      city: row.city || "",
      country: row.country || "CH",
      status: row.status || "active",
      notes: row.notes || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      landlord_id: form.landlord_id.trim() || null,
      title: form.title.trim() || "—",
      street: form.street.trim() || null,
      house_number: form.house_number.trim() || null,
      zip_code: form.zip_code.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || "CH",
      status: form.status.trim() || "active",
      notes: form.notes.trim() || null,
    };
    const promise = editingId
      ? updateAdminProperty(editingId, body)
      : createAdminProperty(body);
    promise
      .then((data) => {
        if (data) {
          setLastGeocodingMeta(data.geocoding ?? null);
          setCoordinateSnapshot(
            data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : { lat: null, lng: null }
          );
        }
        const g = data && data.geocoding;
        if (
          g &&
          g.status !== "ok" &&
          g.reason &&
          g.reason !== "unchanged"
        ) {
          const reason = g.reason;
          let msg =
            "Liegenschaft gespeichert, aber Koordinaten konnten nicht automatisch ermittelt werden.";
          if (reason === "incomplete_address") {
            msg =
              "Liegenschaft gespeichert, aber die Adresse war für die automatische Kartenposition unvollständig.";
          } else if (reason === "provider_unavailable") {
            msg =
              "Liegenschaft gespeichert, aber Koordinaten konnten nicht automatisch ermittelt werden (Geocoding nicht konfiguriert).";
          }
          toast.warning(msg);
        }
        setFormOpen(false);
        load();
      })
      .catch((e) => setError(e.message || "Speichern fehlgeschlagen."))
      .finally(() => setSaving(false));
  };

  const handleRetryGeocode = () => {
    if (!editingId || geocodingRetrying) return;
    setGeocodingRetrying(true);
    geocodeAdminProperty(editingId)
      .then((data) => {
        setLastGeocodingMeta(data.geocoding ?? null);
        setCoordinateSnapshot(
          data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : { lat: null, lng: null }
        );
        const g = data.geocoding;
        if (g && g.status === "ok") {
          toast.success("Koordinaten erfolgreich aktualisiert.");
        } else if (g && g.reason === "incomplete_address") {
          toast.warning("Adresse unvollständig – Koordinaten konnten nicht ermittelt werden.");
        } else if (g && g.reason === "provider_unavailable") {
          toast.warning("Geocoding nicht verfügbar.");
        } else {
          toast.warning("Koordinaten konnten nicht automatisch ermittelt werden.");
        }
        load();
      })
      .catch((e) => toast.error(e.message || "Geocoding fehlgeschlagen."))
      .finally(() => setGeocodingRetrying(false));
  };

  const geoPresent = geocodingStatusPresentation(lastGeocodingMeta, coordinateSnapshot, !editingId);

  const getLandlordLabel = (id) => {
    if (!id) return "—";
    const l = landlords.find((x) => String(x.id) === String(id));
    return l ? (l.company_name || l.contact_name || l.email || id) : id;
  };

  if (loading) {
    return (
      <p className="min-h-[40vh] bg-[#080a0f] px-6 py-8 text-[#4a5070]">Lade Liegenschaften …</p>
    );
  }

  const kpiTotal = properties.length;
  const kpiActive = properties.filter((p) => {
    const s = String(p.status || "").toLowerCase();
    return s === "active" || s === "aktiv";
  }).length;
  const kpiInactiveArchived = properties.filter((p) => {
    const s = String(p.status || "").toLowerCase();
    return s === "inactive" || s === "inaktiv" || s === "archived";
  }).length;

  return (
    <div className="-m-6 min-h-screen bg-[#080a0f]">
      <div className="sticky top-0 z-30 flex h-[50px] items-center justify-between border-b border-[#1c2035] bg-[#0c0e15] px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-[#edf0f7]">
            Van<span className="text-[#5b9cf6]">tio</span>
          </span>
          <span className="text-[#4a5070]">·</span>
          <span className="text-[14px] font-medium text-[#edf0f7]">Liegenschaften</span>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="cursor-pointer rounded-[6px] border border-[rgba(91,156,246,0.28)] bg-[rgba(91,156,246,0.1)] px-[14px] py-[5px] text-[11px] font-medium text-[#5b9cf6]"
        >
          + Neue Liegenschaft
        </button>
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        {error && (
          <p className="text-[14px] text-[#ff5f6d]">{error}</p>
        )}

        <div>
          <div className="mb-[10px] flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.8px] text-[#4a5070]">Übersicht</span>
            <div className="h-px flex-1 bg-[#1c2035]" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-[10px] border border-[#1c2035] bg-[#10121a] p-[13px_15px] transition-colors hover:border-[#242840]">
              <div className="absolute left-0 right-0 top-0 h-[2px] rounded-t-[10px] bg-[#5b9cf6]" />
              <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.5px] text-[#4a5070]">
                Liegenschaften gesamt
              </p>
              <p className="mb-[4px] font-mono text-[22px] font-medium leading-none text-[#5b9cf6]">{kpiTotal}</p>
              <p className="text-[10px] leading-[1.4] text-[#4a5070]">Alle erfassten Liegenschaften</p>
            </div>
            <div className="relative overflow-hidden rounded-[10px] border border-[#1c2035] bg-[#10121a] p-[13px_15px] transition-colors hover:border-[#242840]">
              <div className="absolute left-0 right-0 top-0 h-[2px] rounded-t-[10px] bg-[#3ddc84]" />
              <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.5px] text-[#4a5070]">Aktiv</p>
              <p className="mb-[4px] font-mono text-[22px] font-medium leading-none text-[#3ddc84]">{kpiActive}</p>
              <p className="text-[10px] leading-[1.4] text-[#4a5070]">Aktuell aktive Liegenschaften</p>
            </div>
            <div className="relative overflow-hidden rounded-[10px] border border-[#1c2035] bg-[#10121a] p-[13px_15px] transition-colors hover:border-[#242840]">
              <div className="absolute left-0 right-0 top-0 h-[2px] rounded-t-[10px] bg-[#f5a623]" />
              <p className="mb-[4px] text-[9px] font-medium uppercase tracking-[0.5px] text-[#4a5070]">
                Inaktiv / Archiviert
              </p>
              <p className="mb-[4px] font-mono text-[22px] font-medium leading-none text-[#f5a623]">
                {kpiInactiveArchived}
              </p>
              <p className="text-[10px] leading-[1.4] text-[#4a5070]">Inaktiv oder archiviert</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[12px] border border-[#1c2035] bg-[#10121a]">
          <div className="flex flex-col gap-2 border-b border-[#1c2035] px-[18px] py-[13px] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[13px] font-medium text-[#edf0f7]">Alle Liegenschaften</h3>
              <p className="mt-[2px] text-[10px] text-[#4a5070]">Übersicht und Bearbeitung</p>
            </div>
            <span className="w-fit rounded-[6px] border border-[#1c2035] bg-[#141720] px-[10px] py-[3px] text-[10px] text-[#4a5070]">
              {properties.length} Einträge
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="whitespace-nowrap border-b border-[#1c2035] px-[18px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">
                    Titel
                  </th>
                  <th className="whitespace-nowrap border-b border-[#1c2035] px-[18px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">
                    Adresse
                  </th>
                  <th className="whitespace-nowrap border-b border-[#1c2035] px-[18px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">
                    Vermieter
                  </th>
                  <th className="whitespace-nowrap border-b border-[#1c2035] px-[18px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]">
                    Status
                  </th>
                  <th className="whitespace-nowrap border-b border-[#1c2035] px-[18px] py-[8px] text-left text-[9px] font-medium uppercase tracking-[0.6px] text-[#4a5070]" />
                </tr>
              </thead>
              <tbody>
                {properties.length === 0 ? (
                  <tr className="border-b-0">
                    <td
                      colSpan={5}
                      className="border-b-0 px-[18px] py-[13px] text-[12px] text-[#4a5070]"
                    >
                      Noch keine Einträge. Erstellen Sie eine neue Liegenschaft.
                    </td>
                  </tr>
                ) : (
                  properties.map((row, idx, arr) => {
                    const addr = [row.street, row.house_number, [row.zip_code, row.city].filter(Boolean).join(" ")]
                      .filter(Boolean)
                      .join(", ");
                    const landlord = getLandlordLabel(row.landlord_id);
                    const st = String(row.status || "").toLowerCase();
                    return (
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-b border-[#1c2035] text-[12px] text-[#8892b0] transition-colors hover:bg-[#141720] ${
                          idx === arr.length - 1 ? "border-b-0" : ""
                        }`}
                      >
                        <td className="align-middle px-[18px] py-[13px] text-[12px] font-medium text-[#edf0f7]">
                          {row.title || "—"}
                        </td>
                        <td className="align-middle px-[18px] py-[13px] text-[11px] text-[#5b9cf6]">
                          <span className="flex items-center gap-[4px]">
                            <span aria-hidden>📍</span>
                            {addr || "—"}
                          </span>
                        </td>
                        <td className="align-middle px-[18px] py-[13px] text-[12px] text-[#4a5070]">
                          {landlord}
                        </td>
                        <td className="align-middle px-[18px] py-[13px]">
                          {st === "archived" ? (
                            <span className="inline-flex rounded-full border border-[rgba(255,95,109,0.2)] bg-[rgba(255,95,109,0.1)] px-2 py-[2px] text-[9px] font-semibold text-[#ff5f6d]">
                              Archiviert
                            </span>
                          ) : st === "inactive" || st === "inaktiv" ? (
                            <span className="inline-flex rounded-full border border-[rgba(245,166,35,0.2)] bg-[rgba(245,166,35,0.1)] px-2 py-[2px] text-[9px] font-semibold text-[#f5a623]">
                              Inaktiv
                            </span>
                          ) : st === "active" || st === "aktiv" ? (
                            <span className="inline-flex rounded-full border border-[rgba(61,220,132,0.2)] bg-[rgba(61,220,132,0.1)] px-2 py-[2px] text-[9px] font-semibold text-[#3ddc84]">
                              Aktiv
                            </span>
                          ) : (
                            <span className="text-[12px] text-[#4a5070]">{row.status || "—"}</span>
                          )}
                        </td>
                        <td className="align-middle px-[18px] py-[13px]">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="cursor-pointer rounded-[6px] border border-[#252a3a] bg-[#141720] px-[12px] py-[4px] font-['DM_Sans'] text-[11px] text-[#8892b0] transition-all duration-150 hover:border-[#3b5fcf] hover:bg-[#1a1e2c] hover:text-[#edf0f7]"
                          >
                            Bearbeiten →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70"
          onClick={() => !saving && setFormOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-[420px] overflow-auto rounded-[14px] border border-[#1c2035] bg-[#10121a] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-[18px] font-bold text-[#edf0f7]">
              {editingId ? "Liegenschaft bearbeiten" : "Neue Liegenschaft"}
            </h3>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px" }}>
              <div>
                <label className={labelClass}>Titel *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={inputClass}
                  required
                  placeholder="z.B. Haus Musterstrasse"
                />
              </div>
              <div>
                <label className={labelClass}>Vermieter (optional)</label>
                <select
                  value={form.landlord_id}
                  onChange={(e) => setForm((f) => ({ ...f, landlord_id: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">— Keiner —</option>
                  {landlords.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.company_name || l.contact_name || l.email || l.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Strasse (optional)</label>
                <input
                  type="text"
                  value={form.street}
                  onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Hausnummer (optional)</label>
                <input
                  type="text"
                  value={form.house_number}
                  onChange={(e) => setForm((f) => ({ ...f, house_number: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>PLZ / Ort (optional)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "8px" }}>
                  <input
                    type="text"
                    value={form.zip_code}
                    onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))}
                    className={inputClass}
                    placeholder="PLZ"
                  />
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className={inputClass}
                    placeholder="Ort"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Land (optional)</label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <p className={geoPresent.className}>{geoPresent.text}</p>
              {editingId ? (
                <div>
                  <button
                    type="button"
                    disabled={saving || geocodingRetrying}
                    onClick={handleRetryGeocode}
                    className="rounded-[8px] border border-[#252a3a] bg-[#141720] px-3 py-2 text-[12px] font-semibold text-[#8892b0] transition-colors hover:border-[#3b5fcf] hover:bg-[#1a1e2c] hover:text-[#edf0f7] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {geocodingRetrying ? "Berechne …" : "Koordinaten erneut berechnen"}
                  </button>
                </div>
              ) : null}
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className={inputClass}
                >
                  <option value="active">Aktiv</option>
                  <option value="inactive">Inaktiv</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Notizen (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className={inputClass}
                  style={{ minHeight: "60px" }}
                  rows={2}
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-[8px] border border-[rgba(91,156,246,0.35)] bg-[rgba(91,156,246,0.15)] px-4 py-2.5 font-semibold text-[#5b9cf6] hover:bg-[rgba(91,156,246,0.22)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Speichern …" : "Speichern"}
                </button>
                <button
                  type="button"
                  onClick={() => !saving && setFormOpen(false)}
                  className="rounded-[8px] border border-[#252a3a] bg-[#141720] px-4 py-2.5 font-semibold text-[#8892b0] hover:border-[#3b5fcf] hover:text-[#edf0f7]"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPropertiesPage;
