"use client";

import { useState, useEffect } from "react";
import { ClipboardList, Plus, X, Minus } from "lucide-react";

interface Production {
  id: string;
  title: string;
}

interface ScheduleRow {
  time: string;
  description: string;
}

interface CallSheet {
  id: string;
  productionId: string;
  shootDate: string;
  callTime: string;
  location: { address?: string };
  schedule: ScheduleRow[];
  notes: string | null;
  distributedAt: string | null;
  production: { title: string };
}

interface CreateForm {
  productionId: string;
  shootDate: string;
  callTime: string;
  location: string;
  notes: string;
  schedule: ScheduleRow[];
}

export default function CallSheetsPage() {
  const [callSheets, setCallSheets] = useState<CallSheet[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateForm>({
    productionId: "",
    shootDate: "",
    callTime: "08:00",
    location: "",
    notes: "",
    schedule: [{ time: "", description: "" }],
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/call-sheets").then((r) => r.json()),
      fetch("/api/productions").then((r) => r.json()),
    ])
      .then(([csData, prodData]) => {
        setCallSheets(csData.sheets ?? []);
        setProductions(prodData.productions ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  function addRow() {
    setForm((f) => ({ ...f, schedule: [...f.schedule, { time: "", description: "" }] }));
  }

  function removeRow(i: number) {
    setForm((f) => ({ ...f, schedule: f.schedule.filter((_, idx) => idx !== i) }));
  }

  function updateRow(i: number, field: keyof ScheduleRow, value: string) {
    setForm((f) => {
      const schedule = [...f.schedule];
      schedule[i] = { ...schedule[i], [field]: value };
      return { ...f, schedule };
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/call-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productionId: form.productionId,
          shootDate: form.shootDate,
          callTime: form.callTime,
          location: { address: form.location },
          schedule: form.schedule.filter((r) => r.time || r.description),
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (data.sheet) {
        const updated = await fetch("/api/call-sheets").then((r) => r.json());
        setCallSheets(updated.sheets ?? []);
        setShowCreate(false);
        setForm({
          productionId: "",
          shootDate: "",
          callTime: "08:00",
          location: "",
          notes: "",
          schedule: [{ time: "", description: "" }],
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Call Sheets</h1>
          <p className="text-xs text-gray-500">Shoot schedules and crew call times</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Call Sheet
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="card-apple h-16 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : callSheets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <ClipboardList className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700">No call sheets yet</h2>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Create your first call sheet for an upcoming shoot.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Call Sheet
            </button>
          </div>
        ) : (
          <div className="card-apple overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Production", "Shoot Date", "Call Time", "Location", "Distributed"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {callSheets.map((cs) => (
                  <tr key={cs.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {cs.production.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(cs.shootDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{cs.callTime}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {cs.location?.address ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          cs.distributedAt
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {cs.distributedAt ? "Sent" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Call Sheet Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">New Call Sheet</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-6">
              <form onSubmit={handleCreate} id="create-call-sheet" className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Production *
                  </label>
                  <select
                    required
                    value={form.productionId}
                    onChange={(e) => setForm((f) => ({ ...f, productionId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  >
                    <option value="">Select production…</option>
                    {productions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Shoot Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={form.shootDate}
                      onChange={(e) => setForm((f) => ({ ...f, shootDate: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Call Time
                    </label>
                    <input
                      type="time"
                      value={form.callTime}
                      onChange={(e) => setForm((f) => ({ ...f, callTime: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="Studio address or venue"
                  />
                </div>

                {/* Schedule */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700">Schedule</label>
                    <button
                      type="button"
                      onClick={addRow}
                      className="flex items-center gap-1 text-xs text-[#D4A853] hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      Add row
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.schedule.map((row, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={row.time}
                          onChange={(e) => updateRow(i, "time", e.target.value)}
                          className="w-28 shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#D4A853] focus:outline-none"
                        />
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => updateRow(i, "description", e.target.value)}
                          placeholder="e.g. Talent arrives"
                          className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#D4A853] focus:outline-none"
                        />
                        {form.schedule.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(i)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Notes</label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                    placeholder="Additional notes…"
                  />
                </div>
              </form>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                form="create-call-sheet"
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
