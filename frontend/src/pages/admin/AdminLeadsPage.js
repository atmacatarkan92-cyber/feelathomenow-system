import React from "react";

function AdminLeadsPage() {
  return (
    <div>
      <h2 className="text-3xl font-bold text-slate-800 mb-2">Leads</h2>
      <p className="text-slate-500">
        Übersicht über potenzielle Verwaltungen und Immobilienpartner.
      </p>

      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border">
          <p className="text-slate-500 text-sm">Leads gesamt</p>
          <p className="text-2xl font-bold">0</p>
        </div>

        <div className="bg-white p-4 rounded-xl border">
          <p className="text-slate-500 text-sm">Kontakt aufgenommen</p>
          <p className="text-2xl font-bold">0</p>
        </div>

        <div className="bg-white p-4 rounded-xl border">
          <p className="text-slate-500 text-sm">In Verhandlung</p>
          <p className="text-2xl font-bold">0</p>
        </div>

        <div className="bg-white p-4 rounded-xl border">
          <p className="text-slate-500 text-sm">Partner geworden</p>
          <p className="text-2xl font-bold">0</p>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold mb-4">Lead Übersicht</h3>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="pb-2">Firma</th>
              <th>Kontaktperson</th>
              <th>E-Mail</th>
              <th>Telefon</th>
              <th>Stadt</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr className="border-b">
              <td className="py-2">Muster Immobilien AG</td>
              <td>Max Muster</td>
              <td>info@muster.ch</td>
              <td>+41 44 111 22 33</td>
              <td>Zürich</td>
              <td>Lead</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminLeadsPage;
