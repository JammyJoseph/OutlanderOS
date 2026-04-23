"use client";

import { useState, useEffect } from "react";
import {
  Film,
  Plus,
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

type SheetStatus = "Draft" | "Sent" | "Confirmed";

interface Production {
  id: string;
  title: string;
}

interface CallSheet {
  id: string;
  productionId: string;
  shootDate: string;
  callTime: string;
  location: { address?: string };
  crew: Array<{ type?: string }>;
  notes: string | null;
  distributedAt: string | null;
  production: { title: string };
}

function parseSheetStatus(sheet: CallSheet): SheetStatus {
  if (sheet.distributedAt) return "Sent";
  try {
    if (sheet.notes?.startsWith("{")) {
      const meta = JSON.parse(sheet.notes);
      if (meta.status) return meta.status as SheetStatus;
    }
  } catch {}
  return "Draft";
}

const STATUS_BADGE: Record<SheetStatus, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Confirmed: "bg-emerald-100 text-emerald-700",
};

export default function CallSheetsPage() {
  const [callSheets, setCallSheets] = useState<CallSheet[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    productionId: "",
    shootDate: "",
    callTime: "08:00",
    location: "",
    notes: "",
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
          schedule: [],
          crew: [],
          notes: JSON.stringify({ general: form.notes }),
        }),
      });
      const data = await res.json();
      if (data.sheet) {
        const updated = await fetch("/api/call-sheets").then((r) => r.json());
        setCallSheets(updated.sheets ?? []);
        setShowCreate(false);
        setForm({ productionId: "", shootDate: "", callTime: "08:00", location: "", notes: "" });
      }
    } finally {
      setSaving(false);
    }
  }

  const crewCount = (sheet: CallSheet) =>
    Array.isArray(sheet.crew) ? sheet.crew.filter((c) => c.type === "crew" || !c.type).length : 0;

  const shootTitle = (sheet: CallSheet) => {
    try {
      if (sheet.notes?.startsWith("{")) {
        const meta = JSON.parse(sheet.notes);
        if (meta.shootTitle) return meta.shootTitle;
      }
    } catch {}
    return null;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-apple h-24 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : callSheets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <Film className="h-8 w-8 text-gray-400" />
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
          <div className="space-y-3">
            {callSheets.map((sheet) => {
              const status = parseSheetStatus(sheet);
              const title = shootTitle(sheet);
              const crew = crewCount(sheet);
              const shootDate = new Date(sheet.shootDate);
              return (
                <Link
                  key={sheet.id}
                  href={`/production/call-sheets/${sheet.id}`}
                  className="card-apple group flex items-center gap-4 p-4 transition-all hover:shadow-md"
                >
                  {/* Date badge */}
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-amber-50 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                      {format(shootDate, "MMM")}
                    </span>
                    <span className="text-lg font-bold leading-none text-amber-700">
                      {format(shootDate, "d")}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {title || sheet.production.title}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[status]}`}
                      >
                        {status}
                      </span>
                    </div>
                    {title && (
                      <p className="text-xs text-gray-500 truncate">{sheet.production.title}</p>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {sheet.callTime}
                      </span>
                      {sheet.location?.address && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{sheet.location.address}</span>
                        </span>
                      )}
                      {crew > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {crew} crew
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">New Call Sheet</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 p-6">
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
                  <label className="mb-1 block text-xs font-medium text-gray-700">Call Time</label>
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
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="Any initial notes…"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {saving ? "Creating…" : "Create & Edit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
