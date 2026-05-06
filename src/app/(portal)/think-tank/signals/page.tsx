"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Flag, Loader2, Search, ThumbsUp, X } from "lucide-react";

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

const CATEGORIES = [
  { key: "fashion", label: "Fashion" },
  { key: "luxury", label: "Luxury" },
  { key: "culture", label: "Culture" },
  { key: "food", label: "Food" },
  { key: "art", label: "Art" },
  { key: "music", label: "Music" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "tech", label: "Tech" },
];

const CATEGORY_TONE: Record<string, string> = {
  fashion: "bg-rose-50 text-rose-700 border-rose-100",
  luxury: "bg-amber-50 text-amber-800 border-amber-100",
  culture: "bg-purple-50 text-purple-700 border-purple-100",
  food: "bg-orange-50 text-orange-700 border-orange-100",
  art: "bg-pink-50 text-pink-700 border-pink-100",
  music: "bg-indigo-50 text-indigo-700 border-indigo-100",
  lifestyle: "bg-teal-50 text-teal-700 border-teal-100",
  tech: "bg-sky-50 text-sky-700 border-sky-100",
};

function categoryTone(category: string): string {
  return CATEGORY_TONE[category] ?? "bg-gray-50 text-gray-700 border-gray-100";
}

function relevanceTone(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-[#D4A853]";
  return "bg-gray-300";
}

function sourceLabel(source: string): string {
  return source.replace(/^rss:/, "").replace(/_/g, " ");
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

function SignalLogInner() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category");
  const initialFlagged = searchParams.get("flagged") === "true";
  const initialTrending = searchParams.get("trending") === "true";

  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialCategory ? [initialCategory] : [],
  );
  const [sources, setSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [trendingOnly, setTrendingOnly] = useState(initialTrending);
  const [flaggedOnly, setFlaggedOnly] = useState(initialFlagged);
  const [search, setSearch] = useState("");

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (selectedCategories.length) params.set("categories", selectedCategories.join(","));
    if (selectedSource) params.set("source", selectedSource);
    if (trendingOnly) params.set("trending", "true");
    if (flaggedOnly) params.set("flagged", "true");
    if (search) params.set("search", search);
    return `/api/think-tank/signals?${params.toString()}`;
  }, [selectedCategories, selectedSource, trendingOnly, flaggedOnly, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(buildUrl(), { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? (data as Signal[]) : [];
        setSignals(list);
        const uniqueSources = Array.from(new Set(list.map((s) => s.source))).sort();
        setSources((prev) => (prev.length ? prev : uniqueSources));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildUrl]);

  function toggleCategory(key: string) {
    setSelectedCategories((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleUpvote(id: string) {
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, upvotes: s.upvotes + 1 } : s)));
    try {
      await fetch(`/api/think-tank/signals/${id}/upvote`, { method: "POST" });
    } catch {
      // Silent — UI is optimistic
    }
  }

  async function handleFlag(id: string) {
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, flagged: !s.flagged } : s)));
    try {
      await fetch(`/api/think-tank/signals/${id}/flag`, { method: "POST" });
    } catch {
      // Silent
    }
  }

  function clearFilters() {
    setSelectedCategories([]);
    setSelectedSource("");
    setTrendingOnly(false);
    setFlaggedOnly(false);
    setSearch("");
  }

  const hasFilters = useMemo(
    () => selectedCategories.length > 0 || !!selectedSource || trendingOnly || flaggedOnly || !!search,
    [selectedCategories, selectedSource, trendingOnly, flaggedOnly, search],
  );

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-manrope)]">
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <h1 className="text-base font-semibold text-gray-900">Signal Log</h1>
        <p className="text-xs text-gray-500">Every cultural signal, sortable, filterable.</p>
      </div>

      {/* Filters */}
      <div className="space-y-3 border-b border-gray-100 bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search signals…"
              className="rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-[#7B5BD6] focus:outline-none"
            />
          </div>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-[#7B5BD6] focus:outline-none"
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {sourceLabel(s)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={trendingOnly}
              onChange={(e) => setTrendingOnly(e.target.checked)}
              className="rounded border-gray-300 text-[#7B5BD6] focus:ring-[#7B5BD6]"
            />
            Trending
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => setFlaggedOnly(e.target.checked)}
              className="rounded border-gray-300 text-[#7B5BD6] focus:ring-[#7B5BD6]"
            />
            Flagged
          </label>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const active = selectedCategories.includes(cat.key);
            return (
              <button
                key={cat.key}
                onClick={() => toggleCategory(cat.key)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? `${categoryTone(cat.key)} ring-1 ring-[#7B5BD6]/40`
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-xs text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading signals…
          </div>
        ) : signals.length === 0 ? (
          <div className="mx-auto mt-12 max-w-md rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-xs text-gray-500">
            No signals match your filters. Try clearing them, or refresh feeds from the radar.
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-2">
            {signals.map((s) => (
              <SignalCard key={s.id} signal={s} onUpvote={handleUpvote} onFlag={handleFlag} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SignalCard({
  signal,
  onUpvote,
  onFlag,
}: {
  signal: Signal;
  onUpvote: (id: string) => void;
  onFlag: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <a
          href={signal.sourceUrl ?? "#"}
          target={signal.sourceUrl ? "_blank" : undefined}
          rel="noreferrer"
          className="flex-1 text-sm font-semibold text-gray-900 hover:text-[#7B5BD6]"
        >
          {signal.title}
          {signal.sourceUrl && <ExternalLink className="ml-1 inline h-3 w-3 text-gray-400" />}
        </a>
        <span className="shrink-0 text-[10px] text-gray-400">{timeAgo(signal.createdAt)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryTone(signal.category)}`}>
          {signal.category}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-gray-400">{sourceLabel(signal.source)}</span>
      </div>
      {signal.summary && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 block w-full text-left text-xs leading-relaxed text-gray-600"
        >
          <span className={expanded ? "" : "line-clamp-2"}>{signal.summary}</span>
        </button>
      )}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full ${relevanceTone(signal.relevance)}`}
              style={{ width: `${Math.min(100, Math.max(0, signal.relevance))}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-gray-500">{signal.relevance}</span>
        </div>
        <button
          onClick={() => onUpvote(signal.id)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100"
        >
          <ThumbsUp className="h-3 w-3" />
          {signal.upvotes}
        </button>
        <button
          onClick={() => onFlag(signal.id)}
          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${
            signal.flagged ? "bg-rose-50 text-rose-600" : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <Flag className="h-3 w-3" />
          {signal.flagged ? "Flagged" : "Flag"}
        </button>
      </div>
    </article>
  );
}

export default function SignalLogPage() {
  return (
    <Suspense fallback={null}>
      <SignalLogInner />
    </Suspense>
  );
}
