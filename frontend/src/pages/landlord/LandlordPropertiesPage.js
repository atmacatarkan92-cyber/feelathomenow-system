import React, { useEffect, useState } from "react";
import { fetchLandlordProperties } from "../../api/landlordApi";

function LandlordPropertiesPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetchLandlordProperties()
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || "Objekte konnten nicht geladen werden."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "#64748B" }}>Lade …</p>;
  if (error) return <p style={{ color: "#B91C1C" }}>{error}</p>;

  return (
    <div>
      <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 16px 0", color: "#0F172A" }}>
        Meine Properties
      </h2>
      {list.length === 0 ? (
        <p style={{ color: "#64748B" }}>Keine Objekte vorhanden.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {list.map((p) => (
            <div
              key={p.id}
              style={{
                padding: "16px",
                background: "#FFF",
                border: "1px solid #E5E7EB",
                borderRadius: "12px",
              }}
            >
              <p style={{ margin: 0, fontWeight: 700, color: "#0F172A", fontSize: "16px" }}>
                {p.title || "—"}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748B" }}>
                {[p.street, p.house_number, p.zip_code, p.city].filter(Boolean).join(" ") || "—"}
              </p>
              {p.status && (
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#475569" }}>
                  Status: {p.status}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LandlordPropertiesPage;
