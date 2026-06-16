"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Film, FolderKanban, Loader2 } from "lucide-react";

interface ProjectProduction {
  id: string;
  title: string;
  status: string;
  type: string;
  budgetTotal: number | null;
  budgetActual: number | null;
}

interface Project {
  id: string;
  campaignName: string;
  clientName: string;
  totalBudget: number;
  productionBudget: number;
  mediaBudget: number;
  internalBudget: number;
  otherBudget: number;
  status: string;
  notes: string | null;
  productionId: string | null;
  trelloCardName: string | null;
  createdAt: string;
  production: ProjectProduction | null;
}

function gbp(n: number | null | undefined): string {
  if (n == null) return "—";
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  RECONCILED: "bg-blue-50 text-blue-700",
};

const SPLITS: { key: keyof Project; label: string; color: string }[] = [
  { key: "productionBudget", label: "Production", color: "#ffd700" },
  { key: "mediaBudget", label: "Media", color: "#5B8DEF" },
  { key: "internalBudget", label: "Internal", color: "#10B981" },
  { key: "otherBudget", label: "Other", color: "#9CA3AF" },
];

export default function CommercialProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/commercial/projects")
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d.projects) ? d.projects : []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#141414] font-[family-name:var(--font-manrope)]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#ffd700]">
            OutlanderOS · Commercial
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-gray-900 tracking-tight">
            Projects
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {projects.length} campaign{projects.length !== 1 ? "s" : ""} booked from the
            pipeline
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
            <FolderKanban className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-700">No projects yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Projects will be booked from the new native deal pipeline once it
              launches.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => {
              const splitTotal =
                p.productionBudget + p.mediaBudget + p.internalBudget + p.otherBudget;
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-gray-900 truncate">
                        {p.campaignName}
                      </h2>
                      <p className="text-xs text-gray-500">{p.clientName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          STATUS_TONE[p.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.status}
                      </span>
                      <span className="text-base font-semibold text-gray-900">
                        {gbp(p.totalBudget)}
                      </span>
                    </div>
                  </div>

                  {/* Allocation bar */}
                  <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    {SPLITS.map((s) => {
                      const v = (p[s.key] as number) || 0;
                      const pct = splitTotal > 0 ? (v / splitTotal) * 100 : 0;
                      return (
                        <div
                          key={s.key}
                          style={{ width: `${pct}%`, backgroundColor: s.color }}
                          className="h-full"
                        />
                      );
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {SPLITS.map((s) => (
                      <span
                        key={s.key}
                        className="flex items-center gap-1.5 text-[11px] text-gray-500"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.label} {gbp(p[s.key] as number)}
                      </span>
                    ))}
                  </div>

                  {/* Production link */}
                  {p.production ? (
                    <Link
                      href={`/production/${p.production.id}`}
                      className="mt-4 flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-2.5 transition-colors hover:bg-amber-50"
                    >
                      <span className="flex items-center gap-2 text-xs font-medium text-gray-700">
                        <Film size={14} className="text-[#ffd700]" />
                        Production · {p.production.status} ·{" "}
                        {gbp(p.production.budgetTotal)} allocated
                      </span>
                      <ArrowUpRight size={14} className="text-gray-400" />
                    </Link>
                  ) : (
                    <p className="mt-4 text-[11px] text-gray-400">
                      Supplied-asset campaign · no production
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
