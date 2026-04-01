import React from "react";

function AdminObjektePage() {
  return (
    <div className="min-h-screen bg-[#07090f] text-[#eef2ff]">
      <div className="mx-auto max-w-[min(1400px,100%)] p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-bold text-[#eef2ff]">Objekte</h2>
            <p className="mt-1 text-[12px] text-[#6b7a9a]">
              Übersicht über Gebäude, Standorte und Objektstruktur.
            </p>
          </div>
        </div>

        <div className="rounded-[14px] border border-white/[0.07] bg-[#141824] p-6">
          <h3 className="mb-2 text-[18px] font-bold text-[#eef2ff]">
            Objektübersicht
          </h3>
          <p className="text-[13px] text-[#6b7a9a]">
            Diese Seite bauen wir als Nächstes auf echter Objekt-Ebene auf.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AdminObjektePage;
