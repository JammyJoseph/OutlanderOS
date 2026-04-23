"use client";

import { useState, useEffect } from "react";
import {
  Film,
  Plus,
  Calendar,
  DollarSign,
  Users,
  ClipboardList,
  ArrowRight,
  X,
  Loader2,
  Clock,
  MapPin,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { format, differenceInDays, isAfter, isBefore, addDays } from "date-fns";

type ProductionStatus =
  | "DRAFT"
  | "BRIEFED"
  | "PRE_PRODUCTION"
  | "SHOOTING"
  | "POST_PRODUCTION"
  | "DELIVERED"
  | "ARCHIVED";

const STATUS_STYLES: Record<ProductionStatus, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-600", label: "Draft" },
  BRIEFED: { bg: "bg-blue-100", text: "text-blue-700", label: "Briefed" },
  PRE_PRODUCTION: { bg: "bg-purple-100", text: "text-purple-700", label: "Pre-Production" },
  SHOOTING: { bg: "bg-amber-100", text: "text-amber-700", label: "Shooting" },
  POST_PRODUCTION: { bg: "bg-orange-100", text: "text-orange-700", label: "Post" },
  DELIVERED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Delivered" },
  ARCHIVED: { bg: "bg-gray-100", text: "text-gray-400", label: "Archived" },
};

interface Production {
  id: string;
  title: string;
  brief: string | null;
  status: ProductionStatus;
  budgetTotal: number | null;
  shootDates: string[];
  campaign: { id: string; title: string; client: { id: string; name: string } } | null;
  crew: { id: string; role: string; contact: { name: string } }[];
  callSheets: { id: string; shootDate: string }[];
}

interface UpcomingShoot {
  id: string;
  shootDate: string;
  callTime: string;
  location: { address?: string };
  notes: string | null;
  production: { title: string };
}

function shootTitle(sheet: { notes: string | null; production: { title: string } }) {
  try {
    if (sheet.notes?.startsWith("{")) {
      const m = JSON.parse(sheet.notes);
      if (m.shootTitle) return m.shootTitle;
    }
  } catch {}
  return sheet.production.title;
}

function countdownLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = differenceInDays(target, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `In ${diff}d`;
}

export default function ProductionPage() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [upcomingShoots, setUpcomingShoots] = useState<UpcomingShoot[]>([]);
  const [recentSheets, setRecentSheets] = useState<UpcomingShoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", brief: "", budgetTotal: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/productions").then((r) => r.json()),
      fetch("/api/call-sheets").then((r) => r.json()),
    ]).then(([prodData, sheetData]) => {
      const prods: Production[] = prodData.productions ?? [];
      setProductions(prods);

      const now = new Date();
      const sheets: UpcomingShoot[] = sheetData.sheets ?? [];
      const upcoming = sheets
        .filter((s) => isAfter(new Date(s.shootDate), now) || isBefore(new Date(s.shootDate), addDays(now, 1)))
        .sort((a, b) => new Date(a.shootDate).getTime() - new Date(b.shootDate).getTime())
        .slice(0, 5);
      setUpcomingShoots(upcoming);

      const recent = [...sheets]
        .sort((a, b) => new Date(b.shootDate).getTime() - new Date(a.shootDate).getTime())
        .slice(0, 3);
      setRecentSheets(recent);

      setLoading(false);
    });
  }, []);

  const active = productions.filter(
    (p) => !["DELIVERED", "ARCHIVED"].includes(p.status)
  );
  const upcoming = productions.filter((p) =>
    p.callSheets.some((cs) => isAfter(new Date(cs.shootDate), new Date()))
  );
  const completed = productions.filter((p) => p.status === "DELIVERED");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/productions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          brief: form.brief,
          budgetTotal: form.budgetTotal ? parseFloat(form.budgetTotal) : null,
        }),
      });
      const data = await res.json();
      if (data.production) {
        setProductions((prev) => [data.production, ...prev]);
        setShowCreate(false);
        setForm({ title: "", brief: "", budgetTotal: "" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Production</h1>
          <p className="text-xs text-gray-500">Overview of all shoots and productions</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/production/call-sheets"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Call Sheets
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
          >
            <Plus className="h-3.5 w-3.5" />
            New Production
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Productions", value: active.length, Icon: Film, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Upcoming Shoots", value: upcoming.length, Icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Completed", value: completed.length, Icon: ClipboardList, color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map(({ label, value, Icon, color, bg }) => (
            <div key={label} className="card-apple flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{loading ? "—" : value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Upcoming shoots timeline */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Upcoming Shoots
              </h2>
              <Link
                href="/production/call-sheets"
                className="flex items-center gap-1 text-xs text-[#D4A853] hover:underline"
              >
                All call sheets <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="card-apple h-16 animate-pulse bg-gray-50" />
                ))}
              </div>
            ) : upcomingShoots.length === 0 ? (
              <div className="card-apple flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Calendar className="h-8 w-8 text-gray-200" />
                <p className="text-xs text-gray-400">No upcoming shoots scheduled</p>
                <Link
                  href="/production/call-sheets"
                  className="mt-1 text-xs text-[#D4A853] hover:underline"
                >
                  Create a call sheet
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingShoots.map((shoot) => {
                  const countdown = countdownLabel(shoot.shootDate);
                  const isToday = countdown === "Today";
                  return (
                    <Link
                      key={shoot.id}
                      href={`/production/call-sheets/${shoot.id}`}
                      className="card-apple group flex items-center gap-3 p-3 hover:shadow-md transition-all"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-center ${
                          isToday ? "bg-amber-100" : "bg-gray-50"
                        }`}
                      >
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider ${
                            isToday ? "text-amber-600" : "text-gray-400"
                          }`}
                        >
                          {format(new Date(shoot.shootDate), "MMM")}
                        </span>
                        <span
                          className={`text-sm font-bold leading-none ${
                            isToday ? "text-amber-700" : "text-gray-700"
                          }`}
                        >
                          {format(new Date(shoot.shootDate), "d")}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {shootTitle(shoot)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {shoot.callTime}
                          </span>
                          {shoot.location?.address && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{shoot.location.address}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isToday
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {countdown}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Recent call sheets */}
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Recent Call Sheets
              </h2>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
                  ))}
                </div>
              ) : recentSheets.length === 0 ? (
                <p className="text-xs text-gray-400">No call sheets yet</p>
              ) : (
                <div className="space-y-1.5">
                  {recentSheets.map((sheet) => (
                    <Link
                      key={sheet.id}
                      href={`/production/call-sheets/${sheet.id}`}
                      className="flex items-center gap-2 rounded-lg p-2 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                        <ClipboardList className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-gray-700">
                          {shootTitle(sheet)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {format(new Date(sheet.shootDate), "d MMM yyyy")}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Quick Actions
              </h2>
              <div className="space-y-1.5">
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-left text-xs font-medium text-gray-600 hover:border-[#D4A853] hover:text-[#D4A853] transition-colors"
                >
                  <Film className="h-3.5 w-3.5" />
                  New Production
                </button>
                <Link
                  href="/production/call-sheets"
                  className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-xs font-medium text-gray-600 hover:border-[#D4A853] hover:text-[#D4A853] transition-colors"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  New Call Sheet
                </Link>
                <Link
                  href="/production/briefs"
                  className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-xs font-medium text-gray-600 hover:border-[#D4A853] hover:text-[#D4A853] transition-colors"
                >
                  <Users className="h-3.5 w-3.5" />
                  View Briefs
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Active Productions */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Active Productions
            </h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="card-apple h-24 animate-pulse bg-gray-50" />
              ))}
            </div>
          ) : active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                <Film className="h-7 w-7 text-gray-300" />
              </div>
              <h3 className="text-sm font-semibold text-gray-600">No active productions</h3>
              <p className="mt-1 max-w-xs text-xs text-gray-400">
                Create a production to start managing shoots, briefs, and call sheets.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Production
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map((prod) => {
                const s = STATUS_STYLES[prod.status];
                const nextShoot = prod.callSheets
                  .map((cs) => new Date(cs.shootDate))
                  .filter((d) => isAfter(d, new Date()))
                  .sort((a, b) => a.getTime() - b.getTime())[0];
                return (
                  <Link
                    key={prod.id}
                    href={`/production/${prod.id}`}
                    className="card-apple group flex items-start justify-between gap-4 p-4 hover:shadow-md transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {prod.title}
                        </h3>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}
                        >
                          {s.label}
                        </span>
                      </div>
                      {prod.campaign && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {prod.campaign.client.name} — {prod.campaign.title}
                        </p>
                      )}
                      {prod.brief && (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-400">{prod.brief}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-gray-500">
                      {nextShoot && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(nextShoot, "d MMM")}
                        </span>
                      )}
                      {prod.budgetTotal != null && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          £{prod.budgetTotal.toLocaleString()}
                        </span>
                      )}
                      {prod.crew.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {prod.crew.length} crew
                        </span>
                      )}
                      <ChevronRight className="mt-1 h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Production Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">New Production</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="e.g. Summer Campaign Shoot"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Brief</label>
                <textarea
                  rows={3}
                  value={form.brief}
                  onChange={(e) => setForm((f) => ({ ...f, brief: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="Concept, deliverables, requirements…"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Budget (£)</label>
                <input
                  type="number"
                  min="0"
                  value={form.budgetTotal}
                  onChange={(e) => setForm((f) => ({ ...f, budgetTotal: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#D4A853] focus:outline-none"
                  placeholder="0"
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
                  {saving ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
