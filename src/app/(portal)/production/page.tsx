"use client";

import { useState, useEffect } from "react";
import { Film, Plus, Calendar, ClipboardList, X, Loader2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { format, isAfter } from "date-fns";

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

interface Production {
  id: string;
  title: string;
  status: ProductionStatus;
  shootDates: string[];
  campaign: { client: { name: string } } | null;
  callSheets: { id: string; shootDate: string }[];
}

export default function ProductionPage() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", brief: "", budgetTotal: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/productions")
      .then((r) => r.json())
      .then((data) => {
        setProductions(data.productions ?? []);
        setLoading(false);
      });
  }, []);

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

  const active = productions.filter((p) => !["DELIVERED", "ARCHIVED"].includes(p.status));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Production</h1>
          <p className="text-xs text-gray-500">Manage all production projects and call sheets</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-apple h-36 animate-pulse bg-gray-50" />
            ))}
          </div>
        ) : productions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <Film className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700">No productions yet</h3>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Create your first production project to start managing shoots and call sheets.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-5 flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Project
            </button>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div className="mb-3">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Active ({active.length})
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {active.map((prod) => (
                    <ProductionCard key={prod.id} production={prod} />
                  ))}
                </div>
              </div>
            )}
            {productions.filter((p) => ["DELIVERED", "ARCHIVED"].includes(p.status)).length > 0 && (
              <div className="mt-6">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Completed
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {productions
                    .filter((p) => ["DELIVERED", "ARCHIVED"].includes(p.status))
                    .map((prod) => (
                      <ProductionCard key={prod.id} production={prod} />
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">New Production Project</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Project Title *</label>
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

function ProductionCard({ production }: { production: Production }) {
  const s = STATUS_STYLES[production.status];
  const upcomingDates = production.shootDates.filter((d) => isAfter(new Date(d), new Date()));
  const nextDate = upcomingDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  return (
    <Link
      href={`/production/${production.id}`}
      className="card-apple group flex flex-col gap-3 p-5 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
          <Film className="h-5 w-5 text-[#D4A853]" />
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>
          {s.label}
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-gray-900 group-hover:text-[#D4A853] transition-colors">
          {production.title}
        </h3>
        {production.campaign?.client && (
          <p className="mt-0.5 truncate text-xs text-gray-400">{production.campaign.client.name}</p>
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {production.shootDates.length} shoot{production.shootDates.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <ClipboardList className="h-3 w-3" />
            {production.callSheets.length} sheet{production.callSheets.length !== 1 ? "s" : ""}
          </span>
        </div>
        {nextDate && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            {format(new Date(nextDate), "d MMM")}
          </span>
        )}
      </div>
      <div className="flex items-center justify-end text-gray-300 group-hover:text-[#D4A853] transition-colors">
        <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
