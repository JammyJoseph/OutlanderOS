"use client";

import { useState, useEffect } from "react";
import { Film, Plus, Calendar, DollarSign, Users, ExternalLink, Clipboard, X } from "lucide-react";
import Link from "next/link";

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
}

export default function ProductionPage() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", brief: "", budgetTotal: "" });
  const [saving, setSaving] = useState(false);
  const [figmaUrls, setFigmaUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/productions")
      .then((r) => r.json())
      .then((d) => setProductions(d.productions ?? []))
      .finally(() => setLoading(false));
  }, []);

  const active = productions.filter((p) => !["DELIVERED", "ARCHIVED"].includes(p.status));
  const upcoming = productions.filter((p) =>
    p.shootDates.some((d) => new Date(d) > new Date())
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
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Productions</h1>
          <p className="text-xs text-gray-500">Active shoots and production briefs</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C49843]"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Production
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Productions", value: active.length, Icon: Film, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Upcoming Shoots", value: upcoming.length, Icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Completed", value: completed.length, Icon: Clipboard, color: "text-emerald-600", bg: "bg-emerald-50" },
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

        {/* Productions list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-apple h-28 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : productions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <Film className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-700">No productions yet</h2>
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
            {productions.map((prod) => {
              const s = STATUS_STYLES[prod.status];
              const nextShoot = prod.shootDates
                .map((d) => new Date(d))
                .filter((d) => d > new Date())
                .sort((a, b) => a.getTime() - b.getTime())[0];
              return (
                <div key={prod.id} className="card-apple p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{prod.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                      </div>
                      {prod.campaign && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {prod.campaign.client.name} —{" "}
                          <Link
                            href={`/commercial/clients/${prod.campaign.client.id}`}
                            className="text-[#D4A853] hover:underline"
                          >
                            {prod.campaign.title}
                          </Link>
                        </p>
                      )}
                      {prod.brief && (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-400">{prod.brief}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs text-gray-500">
                      {nextShoot && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {nextShoot.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
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
                    </div>
                  </div>

                  {/* Figma deck */}
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="Attach Figma deck URL…"
                      value={figmaUrls[prod.id] ?? ""}
                      onChange={(e) =>
                        setFigmaUrls((prev) => ({ ...prev, [prod.id]: e.target.value }))
                      }
                      className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 placeholder-gray-300 focus:border-[#D4A853] focus:outline-none"
                    />
                    {figmaUrls[prod.id] && (
                      <a
                        href={figmaUrls[prod.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                    )}
                  </div>

                  {/* Team members */}
                  {prod.crew.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {prod.crew.map((member) => (
                        <span
                          key={member.id}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
                        >
                          {member.contact.name} · {member.role}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
                  className="rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C49843] disabled:opacity-50"
                >
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
