"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive as ArchiveIcon,
  ArchiveRestore,
  Loader2,
  Search,
  CalendarDays,
  User as UserIcon,
} from "lucide-react";
import { STAGE_STYLES, normalizeStage, formatMoney } from "../_components/deal-ui";

interface ArchivedDeal {
  id: string;
  title: string;
  value: number | null;
  archived: boolean;
  archivedAt: string | null;
  archivedByName: string | null;
  stageAtArchive: string | null;
  stage: string;
  client: { id: string; name: string } | null;
}

function dateLabel(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ArchivePage() {
  const [deals, setDeals] = useState<ArchivedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [canUnarchive, setCanUnarchive] = useState(false);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/campaigns?includeArchived=true").then((r) => r.json()),
      fetch("/api/me/permissions")
        .then((r) => r.json())
        .catch(() => ({ canArchiveDeals: false })),
    ])
      .then(([d, perms]) => {
        const list: ArchivedDeal[] = Array.isArray(d) ? d.filter((x: ArchivedDeal) => x.archived) : [];
        list.sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));
        setDeals(list);
        setCanUnarchive(Boolean(perms?.canArchiveDeals));
      })
      .finally(() => setLoading(false));
  }, []);

  async function unarchive(deal: ArchivedDeal) {
    setBusyId(deal.id);
    const previous = deals;
    setDeals((prev) => prev.filter((d) => d.id !== deal.id));
    try {
      const res = await fetch(`/api/campaigns/${deal.id}/unarchive`, { method: "PATCH" });
      if (!res.ok) {
        setDeals(previous);
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Couldn't unarchive this deal.");
      }
    } catch {
      setDeals(previous);
    } finally {
      setBusyId(null);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? deals.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.client?.name ?? "").toLowerCase().includes(q)
      )
    : deals;

  return (
    <div className="min-h-screen bg-card">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--portal-commercial)]">
              OutlanderOS · Commercial
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              <ArchiveIcon className="h-6 w-6 text-gray-400" /> Archive
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {deals.length} archived deal{deals.length !== 1 ? "s" : ""}
              {!canUnarchive && " · view only"}
            </p>
          </div>
          <Link
            href="/commercial/pipeline"
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Back to Pipeline
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search archived deals…"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-2 pl-8 pr-3 text-sm focus:border-[#ffd700] focus:outline-none focus:ring-2 focus:ring-[#ffd700]/30"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 bg-white/40 py-16 text-center">
            <ArchiveIcon className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {deals.length === 0 ? "No archived deals yet." : "No deals match your search."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/60 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Deal</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Client</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Stage at archive</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Archived</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">By</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((deal) => {
                  const stageKey = normalizeStage(deal.stageAtArchive ?? deal.stage);
                  const stage = STAGE_STYLES[stageKey];
                  return (
                    <tr key={deal.id} className="opacity-75 grayscale transition hover:bg-gray-50/60 hover:opacity-100 hover:grayscale-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/commercial/deals/${deal.id}`}
                          className="font-medium text-gray-800 dark:text-gray-200 hover:text-gray-900 hover:underline"
                        >
                          {deal.title}
                        </Link>
                        {deal.value != null && (
                          <span className="ml-2 text-xs tabular-nums text-gray-400">
                            {formatMoney(deal.value)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{deal.client?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${stage?.bg ?? "bg-gray-100"} ${stage?.text ?? "text-gray-500"}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${stage?.dot ?? "bg-gray-300"}`} />
                          {stage?.label ?? stageKey}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={12} className="text-gray-400" />
                          {dateLabel(deal.archivedAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <UserIcon size={12} className="text-gray-400" />
                          {deal.archivedByName ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canUnarchive && (
                          <button
                            onClick={() => unarchive(deal)}
                            disabled={busyId === deal.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                          >
                            {busyId === deal.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <ArchiveRestore size={12} />
                            )}
                            Unarchive
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
