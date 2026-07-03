"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { timeAgo, type TrendSignal } from "./types";
import { ErrorState } from "@/components/ui/error-state";

const CATEGORY_COLORS: Record<string, string> = {
  fashion: "bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  luxury: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  culture: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  food: "bg-lime-50 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",
  art: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  music: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  lifestyle: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  tech: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

// Passive culture/trend news feed from Think Tank RSS ingestion.
export function CultureFeed() {
  const [signals, setSignals] = useState<TrendSignal[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/think-tank/signals?limit=5");
      if (!res.ok) throw new Error(String(res.status));
      setSignals(await res.json());
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

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
          <span className="h-2 w-2 rounded-full bg-orange-400" />
          Culture Feed
        </h2>
        <button
          onClick={refresh}
          disabled={refreshing}
          aria-label="Refresh feeds"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? (
        <ErrorState
          title="Couldn't load the culture feed"
          message="The trend feed didn't load. Try again."
          onRetry={load}
        />
      ) : signals === null ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No stories yet. RSS feeds will populate automatically.
          </p>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-50 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh feeds
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-gray-800">
          {signals.map((s) => (
            <li key={s.id} className="px-4 py-2.5">
              {s.sourceUrl ? (
                <a
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="line-clamp-2 text-sm text-gray-800 hover:text-[#ffd700] dark:text-gray-200"
                >
                  {s.title}
                </a>
              ) : (
                <span className="line-clamp-2 text-sm text-gray-800 dark:text-gray-200">{s.title}</span>
              )}
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                    CATEGORY_COLORS[s.category] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {categoryLabel(s.category)}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">{timeAgo(s.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <Link
          href="/think-tank"
          className="text-xs font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
        >
          See all →
        </Link>
      </div>
    </section>
  );
}
