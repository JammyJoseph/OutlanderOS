"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Bookmark,
  ChevronRight,
  ExternalLink,
  Flag,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";

interface Signal {
  id: string;
  title: string;
  source: string;
  sourceUrl: string | null;
  category: string;
  summary: string | null;
  relevance: number;
  trending: boolean;
  upvotes: number;
  flagged: boolean;
  createdAt: string;
}

interface Brand {
  id: string;
}

interface Report {
  id: string;
}

const CATEGORIES = [
  { key: "fashion", label: "Fashion", color: "bg-rose-50 text-rose-700 border-rose-100" },
  { key: "luxury", label: "Luxury", color: "bg-amber-50 text-amber-800 border-amber-100" },
  { key: "culture", label: "Culture", color: "bg-purple-50 text-purple-700 border-purple-100" },
  { key: "food", label: "Food", color: "bg-orange-50 text-orange-700 border-orange-100" },
  { key: "art", label: "Art", color: "bg-pink-50 text-pink-700 border-pink-100" },
  { key: "music", label: "Music", color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  { key: "lifestyle", label: "Lifestyle", color: "bg-teal-50 text-teal-700 border-teal-100" },
  { key: "tech", label: "Tech", color: "bg-sky-50 text-sky-700 border-sky-100" },
];

function categoryStyle(category: string): string {
  return CATEGORIES.find((c) => c.key === category)?.color ?? "bg-gray-50 text-gray-700 border-gray-100";
}

function relevanceTone(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-[#D4A853]";
  return "bg-gray-300";
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function sourceLabel(source: string): string {
  return source.replace(/^rss:/, "").replace(/_/g, " ");
}

export default function ThinkTankRadarPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [lastIngest, setLastIngest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, b, r] = await Promise.allSettled([
        fetch("/api/think-tank/signals?limit=200", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/think-tank/brands", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/think-tank/reports", { cache: "no-store" }).then((res) => res.json()),
      ]);
      setSignals(s.status === "fulfilled" && Array.isArray(s.value) ? s.value : []);
      setBrands(b.status === "fulfilled" && Array.isArray(b.value) ? b.value : []);
      setReports(r.status === "fulfilled" && Array.isArray(r.value) ? r.value : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleIngest() {
    setIngesting(true);
    setError(null);
    try {
      const res = await fetch("/api/think-tank/ingest", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ingestion failed");
      } else {
        setLastIngest(data.ranAt || new Date().toISOString());
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ingestion failed");
    } finally {
      setIngesting(false);
    }
  }

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const thisWeek = signals.filter((s) => new Date(s.createdAt).getTime() >= weekAgo).length;
    const rising = signals.filter((s) => s.trending).length;
    return {
      thisWeek,
      rising,
      brands: brands.length,
      reports: reports.length,
    };
  }, [signals, brands, reports]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { count: number; topTitle: string | null }>();
    for (const cat of CATEGORIES) map.set(cat.key, { count: 0, topTitle: null });
    for (const s of signals) {
      const entry = map.get(s.category) ?? { count: 0, topTitle: null };
      entry.count++;
      if (!entry.topTitle) entry.topTitle = s.title;
      map.set(s.category, entry);
    }
    return map;
  }, [signals]);

  const hotSignals = useMemo(
    () => [...signals].sort((a, b) => b.relevance - a.relevance || b.upvotes - a.upvotes).slice(0, 5),
    [signals],
  );

  const recentSignals = useMemo(() => signals.slice(0, 20), [signals]);

  const isEmpty = !loading && signals.length === 0;

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-manrope)]">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white/80 px-6 py-3 backdrop-blur-md">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="h-2 w-2 rounded-full bg-[#E67E22]" />
            Trend Radar
          </h1>
          <p className="text-xs text-gray-500">
            Cultural intelligence for Outlander
            {lastIngest && <span className="text-gray-400"> · last refresh {timeAgo(lastIngest)}</span>}
          </p>
        </div>
        <button
          onClick={handleIngest}
          disabled={ingesting}
          className="flex items-center gap-2 rounded-lg bg-[#E67E22] px-3 py-2 text-xs font-semibold text-white hover:bg-[#CF6D14] disabled:opacity-50 transition-colors"
        >
          {ingesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {ingesting ? "Refreshing feeds…" : "Refresh Feeds"}
        </button>
      </div>

      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-700">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-5">
        {isEmpty ? (
          <EmptyState onIngest={handleIngest} ingesting={ingesting} />
        ) : (
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Signals this week" value={stats.thisWeek} icon={<Activity className="h-4 w-4" />} />
              <StatCard label="Rising trends" value={stats.rising} icon={<TrendingUp className="h-4 w-4" />} />
              <StatCard label="Brands watched" value={stats.brands} icon={<Bookmark className="h-4 w-4" />} />
              <StatCard label="Reports generated" value={stats.reports} icon={<Sparkles className="h-4 w-4" />} />
            </div>

            {/* Category grid */}
            <section>
              <SectionHeader title="Categories" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {CATEGORIES.map((cat) => {
                  const entry = byCategory.get(cat.key) ?? { count: 0, topTitle: null };
                  return (
                    <Link
                      key={cat.key}
                      href={`/think-tank/signals?category=${cat.key}`}
                      className={`group flex flex-col gap-2 rounded-xl border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${cat.color.split(" ")[2]}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cat.color}`}>
                          {cat.label}
                        </span>
                        <span className="text-xs font-bold text-gray-700">{entry.count}</span>
                      </div>
                      <p className="line-clamp-2 text-[11px] leading-tight text-gray-500">
                        {entry.topTitle ?? "No signals yet"}
                      </p>
                      <div className="mt-auto flex items-center gap-1 text-[10px] font-medium text-gray-400 group-hover:text-[#E67E22]">
                        View signals <ChevronRight className="h-3 w-3" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Hot signals */}
            <section>
              <SectionHeader title="Hot Signals" subtitle="Top by relevance" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {hotSignals.map((s) => (
                  <HotSignalCard key={s.id} signal={s} />
                ))}
                {hotSignals.length === 0 && (
                  <p className="col-span-full text-xs text-gray-400">No signals yet.</p>
                )}
              </div>
            </section>

            {/* Recent feed */}
            <section>
              <SectionHeader title="Recent Signals" subtitle={`${recentSignals.length} most recent`} actionHref="/think-tank/signals" actionLabel="View all" />
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <ul className="divide-y divide-gray-100">
                  {recentSignals.map((s) => (
                    <li key={s.id} className="px-4 py-3 hover:bg-gray-50">
                      <a
                        href={s.sourceUrl ?? "#"}
                        target={s.sourceUrl ? "_blank" : undefined}
                        rel="noreferrer"
                        className="flex flex-col gap-1.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="line-clamp-2 text-sm font-medium text-gray-900">{s.title}</p>
                          <span className="shrink-0 text-[10px] text-gray-400">{timeAgo(s.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryStyle(s.category)}`}>
                            {s.category}
                          </span>
                          <span className="text-[10px] uppercase tracking-wide text-gray-400">{sourceLabel(s.source)}</span>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#E67E22]/10 text-[#E67E22]">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
      </div>
      {actionHref && (
        <Link href={actionHref} className="flex items-center gap-1 text-[11px] font-semibold text-[#E67E22] hover:text-[#CF6D14]">
          {actionLabel} <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function HotSignalCard({ signal }: { signal: Signal }) {
  return (
    <a
      href={signal.sourceUrl ?? "#"}
      target={signal.sourceUrl ? "_blank" : undefined}
      rel="noreferrer"
      className="group flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryStyle(signal.category)}`}>
          {signal.category}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-gray-400">{sourceLabel(signal.source)}</span>
      </div>
      <p className="line-clamp-3 text-sm font-semibold text-gray-900">{signal.title}</p>
      <div className="mt-auto space-y-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full ${relevanceTone(signal.relevance)} transition-all`}
            style={{ width: `${Math.min(100, Math.max(0, signal.relevance))}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {signal.upvotes}
          </span>
          {signal.flagged && (
            <span className="flex items-center gap-1 text-rose-500">
              <Flag className="h-3 w-3" />
              flagged
            </span>
          )}
          {signal.sourceUrl && (
            <span className="flex items-center gap-1 text-[#E67E22] opacity-0 transition-opacity group-hover:opacity-100">
              Open <ExternalLink className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

function EmptyState({ onIngest, ingesting }: { onIngest: () => void; ingesting: boolean }) {
  return (
    <div className="mx-auto mt-12 max-w-md rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E67E22]/10 text-[#E67E22]">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-gray-900">Your radar is dark</h2>
      <p className="mt-1 text-xs text-gray-500">
        Pull in signals from Business of Fashion, Highsnobiety, Hypebeast and more to start mapping the cultural moment.
      </p>
      <button
        onClick={onIngest}
        disabled={ingesting}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#E67E22] px-4 py-2 text-xs font-semibold text-white hover:bg-[#CF6D14] disabled:opacity-50"
      >
        {ingesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Ingest your first feeds
      </button>
    </div>
  );
}
