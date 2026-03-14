import React from "react";

function AdminObjektePage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Objekte</h2>
          <p className="text-slate-500 mt-1">
            Übersicht über Gebäude, Standorte und Objektstruktur.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-xl font-semibold text-slate-800 mb-2">
          Objektübersicht
        </h3>
        <p className="text-slate-500">
          Diese Seite bauen wir als Nächstes auf echter Objekt-Ebene auf.
        </p>
      </div>
    </div>
  );
}

export default AdminObjektePage;