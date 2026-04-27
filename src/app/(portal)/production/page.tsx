"use client";

import { useState, useEffect } from "react";
import { Film, Plus, Calendar, ClipboardList, ChevronRight, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { format, parseISO, isFuture } from "date-fns";

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
  shootDates: string[];
  campaign: { title: string; client: { name: string } } | null;
  crew: { id: string }[];
  callSheets: { id: string; shootDate: string }[];
}

function getNextShootDate(
  callSheets: { shootDate: string }[] | undefined,
  shootDates: string[] | undefined
): Date | null {
  const allDates = [
    ...(callSheets ?? []).map((cs) => new Date(cs.shootDate)),
    ...(shootDates ?? []).map((d) => new Date(d)),
  ].filter((d) => isFuture(d));
  if (!allDates.length) return null;
  return allDates.sort((a, b) => a.getTime() - b.getTime())[0];
}

export default function ProductionDashboard() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", client: "" });

  useEffect(() => {
    fetch("/api/productions")
      .then((r) => (r.ok ? r.json() : { productions: [] }))
      .then((d) => setProductions(Array.isArray(d?.productions) ? d.productions : []))
      .catch(() => setProductions([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/productions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title }),
      });
      const data = await res.json();
      if (data.production) {
        setProductions((prev) => [data.production, ...prev]);
        setShowCreate(false);
        setForm({ title: "", client: "" });
      }
    } finally {
      setCreating(false);
    }
  }

  const active = productions.filter((p) => !["DELIVERED", "ARCHIVED"].includes(p.status));
  const archived = productions.filter((p) => ["DELIVERED", "ARCHIVED"].includes(p.status));

  return (
    <div className="min-h-screen bg-[#F9F9F7]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Productions</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {productions.length} project{productions.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors shadow-sm"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        )}

        {/* Empty state */}
        {!loading && productions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
              <Film size={28} className="text-[#D4A853]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">No projects yet</h2>
            <p className="text-gray-500 text-sm mb-6">Create your first production project to get started.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors"
            >
              <Plus size={16} />
              New Project
            </button>
          </div>
        )}

        {/* Active projects */}
        {!loading && active.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Active — {active.length}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map((p) => (
                <ProjectCard key={p.id} production={p} />
              ))}
            </div>
          </div>
        )}

        {/* Archived / Delivered */}
        {!loading && archived.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Completed — {archived.length}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {archived.map((p) => (
                <ProjectCard key={p.id} production={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Summer Campaign 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A853]/30 focus:border-[#D4A853]"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!form.title.trim() || creating}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#D4A853] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#c49843] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? <Loader2 size={15} className="animate-spin" /> : null}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ production: p }: { production: Production }) {
  const callSheets = p.callSheets ?? [];
  const shootDates = p.shootDates ?? [];
  const nextShoot = getNextShootDate(callSheets, shootDates);
  const style = STATUS_STYLES[p.status] || STATUS_STYLES.DRAFT;
  const clientName = p.campaign?.client?.name ?? null;

  return (
    <Link href={`/production/${p.id}`}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-5 group cursor-pointer h-full flex flex-col">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Film size={18} className="text-[#D4A853]" />
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
            {style.label}
          </span>
        </div>

        {/* Title + client */}
        <div className="flex-1 mb-4">
          <h3 className="font-semibold text-gray-900 text-base leading-snug group-hover:text-[#D4A853] transition-colors">
            {p.title}
          </h3>
          {clientName && (
            <p className="text-gray-500 text-sm mt-0.5">{clientName}</p>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <ClipboardList size={13} />
            {callSheets.length} call sheet{callSheets.length !== 1 ? "s" : ""}
          </span>
          {nextShoot ? (
            <span className="flex items-center gap-1.5">
              <Calendar size={13} />
              {format(nextShoot, "d MMM")}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-gray-400">
              <Calendar size={13} />
              No shoots
            </span>
          )}
        </div>

        {/* Arrow */}
        <div className="flex justify-end mt-3">
          <ChevronRight size={16} className="text-gray-300 group-hover:text-[#D4A853] transition-colors" />
        </div>
      </div>
    </Link>
  );
}
