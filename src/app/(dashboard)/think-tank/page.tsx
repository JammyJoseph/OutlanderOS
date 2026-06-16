"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

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
  fashion: "bg-pink-50 text-pink-700",
  luxury: "bg-amber-50 text-amber-700",
  culture: "bg-orange-50 text-orange-700",
  food: "bg-lime-50 text-lime-700",
  art: "bg-violet-50 text-violet-700",
  music: "bg-blue-50 text-blue-700",
  lifestyle: "bg-teal-50 text-teal-700",
  tech: "bg-slate-100 text-slate-700",
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

  const load = useCallback(async () => {
    const [signalsRes, brandsRes] = await Promise.all([
      fetch("/api/think-tank/signals?limit=100").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/think-tank/brands").then((r) => (r.ok ? r.json() : [])),
    ]);
    setSignals(signalsRes);
    setBrands(brandsRes);
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
    <div className="min-h-full bg-[#0a0a0a] p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
              Think Tank
            </h1>
            <p className="mt-0.5 text-sm text-gray-400">
              Culture and trend signals from across fashion, art, music and more.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl bg-orange-50 px-3.5 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-50"
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
                  : "bg-white text-gray-500 shadow-sm hover:text-gray-800"
              }`}
            >
              {c === "all" ? "All" : label(c)}
            </button>
          ))}
        </div>

        {/* Signal feed */}
        {signals === null ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-12 text-center shadow-sm">
            <p className="text-sm text-gray-400">
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
                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {s.sourceUrl ? (
                      <a
                        href={s.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-start gap-1.5 text-sm font-semibold text-gray-900 hover:text-[#e6c200]"
                      >
                        {s.title}
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-gray-300 group-hover:text-[#e6c200]" />
                      </a>
                    ) : (
                      <span className="text-sm font-semibold text-gray-900">{s.title}</span>
                    )}
                    {s.summary && (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{s.summary}</p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      CATEGORY_COLORS[s.category] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {label(s.category)}
                  </span>
                  <span className="text-[11px] font-medium text-gray-500">{s.source}</span>
                  <span className="text-[11px] text-gray-400">{timeAgo(s.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Brand watchlist */}
        <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">Brand Watchlist</h2>
          </div>
          {brands.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              No brands being tracked yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {brands.map((b) => {
                const mentions = mentionsFor(b);
                return (
                  <li key={b.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold text-gray-900">
                          {b.name}
                        </span>
                        {b.category && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              CATEGORY_COLORS[b.category.toLowerCase()] ??
                              "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {label(b.category)}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-xs text-gray-400">
                        {b.trajectory === "rising" && (
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
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
                          <li key={m.id} className="truncate text-xs text-gray-500">
                            {m.sourceUrl ? (
                              <a
                                href={m.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-[#e6c200]"
                              >
                                {m.title}
                              </a>
                            ) : (
                              m.title
                            )}
                            <span className="text-gray-300"> · {timeAgo(m.createdAt)}</span>
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
