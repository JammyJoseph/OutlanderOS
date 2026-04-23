"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Film,
  ClipboardList,
  Plus,
  ChevronRight,
  ChevronLeft,
  Loader2,
  X,
  Edit2,
  Check,
} from "lucide-react";
import { format, isAfter, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths } from "date-fns";

type ProductionStatus =
  | "DRAFT" | "BRIEFED" | "PRE_PRODUCTION" | "SHOOTING" | "POST_PRODUCTION" | "DELIVERED" | "ARCHIVED";

const STATUS_STYLES: Record<ProductionStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-600", label: "Draft" },
  BRIEFED: { bg: "bg-blue-100", text: "text-blue-700", label: "Briefed" },
  PRE_PRODUCTION: { bg: "bg-purple-100", text: "text-purple-700", label: "Pre-Production" },
  SHOOTING: { bg: "bg-amber-100", text: "text-amber-700", label: "Shooting" },
  POST_PRODUCTION: { bg: "bg-orange-100", text: "text-orange-700", label: "Post" },
  DELIVERED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Delivered" },
  ARCHIVED: { bg: "bg-gray-100", text: "text-gray-400", label: "Archived" },
};

const CS_STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SAVED: "bg-blue-100 text-blue-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
};
const CS_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SAVED: "Saved",
  PUBLISHED: "Published",
};

interface CallSheetSummary {
  id: string;
  status: string;
  shootDate: string;
  callTime: string;
  notes: string | null;
}

interface Production {
  id: string;
  title: string;
  brief: string | null;
  status: ProductionStatus;
  shootDates: string[];
  campaign: { id: string; title: string; client: { id: string; name: string } } | null;
  callSheets: CallSheetSummary[];
}

function csTitle(sheet: CallSheetSummary): string {
  try {
    if (sheet.notes?.startsWith("{")) {
      const m = JSON.parse(sheet.notes);
      if (m.shootTitle) return m.shootTitle;
    }
  } catch {}
  return format(new Date(sheet.shootDate), "EEE d MMM yyyy");
}

function MiniCalendar({ shootDates }: { shootDates: string[] }) {
  const [month, setMonth] = useState(new Date());

  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const startPad = (getDay(start) + 6) % 7; // Monday-first

  const shootSet = new Set(
    shootDates.map((d) => format(new Date(d), "yyyy-MM-dd"))
  );

  return (
    <div className="card-apple p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Shoot Calendar
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[80px] text-center text-xs font-medium text-gray-700">
            {format(month, "MMM yyyy")}
          </span>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {d}
          </div>
        ))}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const isShoot = shootSet.has(key);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={key}
              className={`flex items-center justify-center rounded-lg py-1 text-xs font-medium ${
                isShoot
                  ? "bg-[#D4A853] text-white"
                  : isToday
                  ? "bg-gray-100 text-gray-900 font-bold"
                  : "text-gray-500"
              }`}
            >
              {format(day, "d")}
            </div>
          );
        })}
      </div>

      {shootDates.length === 0 && (
        <p className="mt-3 text-center text-[10px] text-gray-400">No shoot dates set</p>
      )}
    </div>
  );
}

export default function ProductionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [production, setProduction] = useState<Production | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [savedTitle, setSavedTitle] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [csForm, setCsForm] = useState({ title: "", shootDate: "" });
  const [creatingCs, setCreatingCs] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/productions/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setProduction(data.production);
        setTitleDraft(data.production?.title || "");
        setLoading(false);
      });
  }, [id]);

  async function saveTitle() {
    if (!production) return;
    setSavingTitle(true);
    try {
      await fetch(`/api/productions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleDraft }),
      });
      setProduction((p) => (p ? { ...p, title: titleDraft } : p));
      setEditingTitle(false);
      setSavedTitle(true);
      setTimeout(() => setSavedTitle(false), 2000);
    } finally {
      setSavingTitle(false);
    }
  }

  async function updateStatus(status: ProductionStatus) {
    if (!production) return;
    await fetch(`/api/productions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setProduction((p) => (p ? { ...p, status } : p));
  }

  async function createCallSheet(e: React.FormEvent) {
    e.preventDefault();
    setCreatingCs(true);
    try {
      const res = await fetch(`/api/productions/${id}/call-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: csForm.title,
          shootDate: csForm.shootDate,
        }),
      });
      const data = await res.json();
      if (data.sheet) {
        router.push(`/production/${id}/call-sheets/${data.sheet.id}`);
      }
    } finally {
      setCreatingCs(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#D4A853]" />
      </div>
    );
  }

  if (!production) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-gray-500">Production not found.</p>
        <Link href="/production" className="rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white">
          Back to Projects
        </Link>
      </div>
    );
  }

  const s = STATUS_STYLES[production.status];
  const sortedSheets = [...production.callSheets].sort(
    (a, b) => new Date(a.shootDate).getTime() - new Date(b.shootDate).getTime()
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/production"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                  className="rounded-lg border border-[#D4A853] px-2 py-1 text-sm font-semibold focus:outline-none"
                />
                <button onClick={saveTitle} disabled={savingTitle} className="text-[#D4A853]">
                  {savingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button onClick={() => { setEditingTitle(false); setTitleDraft(production.title); }} className="text-gray-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold text-gray-900">{production.title}</h1>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>
                  {s.label}
                </span>
                <button
                  onClick={() => setEditingTitle(true)}
                  className="text-gray-300 hover:text-gray-500"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                {savedTitle && <span className="text-[10px] text-emerald-600">Saved</span>}
              </div>
            )}
            {production.campaign && (
              <p className="truncate text-xs text-gray-400">
                {production.campaign.client.name} — {production.campaign.title}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={production.status}
            onChange={(e) => updateStatus(e.target.value as ProductionStatus)}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 focus:border-[#D4A853] focus:outline-none"
          >
            {Object.entries(STATUS_STYLES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Call Sheet
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-3 gap-5">
            {/* Left: Calendar + Call Sheets */}
            <div className="col-span-2 space-y-5">
              <MiniCalendar shootDates={production.shootDates} />

              {/* Call Sheets */}
              <div className="card-apple p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Call Sheets ({sortedSheets.length})
                  </h2>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="text-[10px] font-medium text-[#D4A853] hover:underline"
                  >
                    + New call sheet
                  </button>
                </div>

                {sortedSheets.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <ClipboardList className="h-8 w-8 text-gray-200" />
                    <p className="text-xs text-gray-400">No call sheets for this production.</p>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#C49843]"
                    >
                      Create First Call Sheet
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {sortedSheets.map((sheet) => {
                      const statusKey = sheet.status || "DRAFT";
                      return (
                        <Link
                          key={sheet.id}
                          href={`/production/${id}/call-sheets/${sheet.id}`}
                          className="group flex items-center gap-3 rounded-xl p-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-amber-50 text-center">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-amber-600">
                              {format(new Date(sheet.shootDate), "MMM")}
                            </span>
                            <span className="text-sm font-bold leading-none text-amber-700">
                              {format(new Date(sheet.shootDate), "d")}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-gray-800">
                                {csTitle(sheet)}
                              </p>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${CS_STATUS_BADGE[statusKey] ?? "bg-gray-100 text-gray-600"}`}>
                                {CS_STATUS_LABEL[statusKey] ?? statusKey}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400">
                              {format(new Date(sheet.shootDate), "EEE d MMM yyyy")}
                              {sheet.callTime && ` · ${sheet.callTime}`}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-gray-500 transition-colors" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Project info */}
            <div className="space-y-4">
              <div className="card-apple p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Project Info
                </h2>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>{s.label}</span>
                  </div>
                  {production.campaign && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Client</span>
                        <span className="font-medium text-gray-700">{production.campaign.client.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Campaign</span>
                        <span className="font-medium text-gray-700 truncate ml-2 text-right">{production.campaign.title}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Shoot dates</span>
                    <span className="font-medium text-gray-700">{production.shootDates.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Call sheets</span>
                    <span className="font-medium text-gray-700">{production.callSheets.length}</span>
                  </div>
                </div>
              </div>

              {production.brief && (
                <div className="card-apple p-5">
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Brief</h2>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{production.brief}</p>
                </div>
              )}

              {production.shootDates.length > 0 && (
                <div className="card-apple p-5">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Shoot Dates</h2>
                  <div className="space-y-1.5">
                    {[...production.shootDates]
                      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                      .map((date) => {
                        const d = new Date(date);
                        const isPast = !isAfter(d, new Date());
                        return (
                          <div key={date} className="flex items-center gap-2">
                            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${isPast ? "bg-gray-100 text-gray-400" : "bg-amber-100 text-amber-700"}`}>
                              {format(d, "d")}
                            </div>
                            <span className={`text-xs ${isPast ? "text-gray-400" : "text-gray-700"}`}>
                              {format(d, "EEE d MMM yyyy")}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Call Sheet Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">New Call Sheet</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={createCallSheet} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Title</label>
                <input
                  value={csForm.title}
                  onChange={(e) => setCsForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="e.g. Day 1 — Studio A"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Shoot Date *</label>
                <input
                  required
                  type="date"
                  value={csForm.shootDate}
                  onChange={(e) => setCsForm((f) => ({ ...f, shootDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCs}
                  className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
                >
                  {creatingCs && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {creatingCs ? "Creating…" : "Create & Edit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
