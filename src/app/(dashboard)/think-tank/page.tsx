"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";

interface Signal {
  id: string;
  title: string;
  source: string;
  sourceUrl: string | null;
  category: string;
  summary: string | null;
  createdAt: string;
}

interface Brand {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  keywords: string[];
  signalCount: number;
  heatScore: number;
  trajectory: string;
  lastChecked: string | null;
}

const CATEGORIES = [
  "fashion",
  "luxury",
  "culture",
  "food",
  "art",
  "music",
  "lifestyle",
  "tech",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  fashion: "bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300",
  luxury: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  culture: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  food: "bg-lime-50 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300",
  art: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
  music: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  lifestyle: "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
  tech: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
};

function label(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Standalone Think Tank feed — culture/trend signals from RSS ingestion plus
// the brand watchlist. Not a portal; lives under the dashboard layout.
export default function ThinkTankPage() {
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [signalsRes, brandsRes] = await Promise.all([
        fetch("/api/think-tank/signals?limit=100").then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        }),
        fetch("/api/think-tank/brands").then((r) => (r.ok ? r.json() : [])),
      ]);
      setSignals(signalsRes);
      setBrands(brandsRes);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetch("/api/think-tank/ingest", { method: "POST" });
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(() => {
    if (!signals) return [];
    if (category === "all") return signals;
    return signals.filter((s) => s.category === category);
  }, [signals, category]);

  // Latest mentions per brand — signals whose title matches the brand name
  // or one of its keywords.
  const mentionsFor = useCallback(
    (brand: Brand): Signal[] => {
      if (!signals) return [];
      const needles = [brand.name, ...brand.keywords]
        .map((k) => k.toLowerCase())
        .filter(Boolean);
      return signals
        .filter((s) => {
          const haystack = `${s.title} ${s.summary ?? ""}`.toLowerCase();
          return needles.some((n) => haystack.includes(n));
        })
        .slice(0, 2);
    },
    [signals],
  );

  return (
    <div className="min-h-full bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
              Think Tank
            </h1>
            <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">
              Culture and trend signals from across fashion, art, music and more.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl bg-orange-50 dark:bg-orange-900/30 px-3.5 py-2 text-sm font-semibold text-orange-700 dark:text-orange-300 transition-colors hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh feeds
          </button>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5">
          {["all", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                category === c
                  ? "bg-gray-900 text-white"
                  : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 shadow-sm hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              {c === "all" ? "All" : label(c)}
            </button>
          ))}
        </div>

        {/* Signal feed */}
        {error ? (
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <ErrorState
              title="Couldn't load Think Tank"
              message="The signal feed didn't load. Check your connection and try again."
              onRetry={load}
            />
          </div>
        ) : signals === null ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-12 text-center shadow-sm">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {category === "all"
                ? "No stories yet. RSS feeds will populate automatically."
                : `No ${label(category)} stories yet.`}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {s.sourceUrl ? (
                      <a
                        href={s.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-start gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-[#9C7C2E] dark:hover:text-[#C9A44A]"
                      >
                        {s.title}
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-[#9C7C2E] dark:group-hover:text-[#C9A44A]" />
                      </a>
                    ) : (
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.title}</span>
                    )}
                    {s.summary && (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{s.summary}</p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      CATEGORY_COLORS[s.category] ?? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {label(s.category)}
                  </span>
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{s.source}</span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">{timeAgo(s.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Brand watchlist */}
        <section className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Brand Watchlist</h2>
          </div>
          {brands.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              No brands being tracked yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-50 dark:divide-gray-800">
              {brands.map((b) => {
                const mentions = mentionsFor(b);
                return (
                  <li key={b.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {b.name}
                        </span>
                        {b.category && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              CATEGORY_COLORS[b.category.toLowerCase()] ??
                              "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {label(b.category)}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                        {b.trajectory === "rising" && (
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                        )}
                        {b.trajectory === "falling" && (
                          <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                        )}
                        <span>Heat {b.heatScore}</span>
                      </div>
                    </div>
                    {mentions.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {mentions.map((m) => (
                          <li key={m.id} className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {m.sourceUrl ? (
                              <a
                                href={m.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-[#9C7C2E] dark:hover:text-[#C9A44A]"
                              >
                                {m.title}
                              </a>
                            ) : (
                              m.title
                            )}
                            <span className="text-gray-300 dark:text-gray-600"> · {timeAgo(m.createdAt)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
