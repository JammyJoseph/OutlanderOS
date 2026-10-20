"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { timeAgo, type TrendSignal } from "./types";
import { ErrorState } from "@/components/ui/error-state";

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
    <section className="rounded-2xl bg-surface px-6 py-6" aria-label="Culture radar">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Culture radar</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Refresh feeds"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} strokeWidth={1.75} />
          </button>
          <Link href="/think-tank" className="text-sm font-semibold underline decoration-[1.5px] underline-offset-4 hover:text-brand">
            Think tank
          </Link>
        </div>
      </div>

      {error ? (
        <ErrorState title="Couldn't load the culture feed" message="The trend feed didn't load. Try again." onRetry={load} />
      ) : signals === null ? (
        <div className="space-y-3 pt-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-[15px] text-muted-foreground">No stories yet. The feeds fill in on their own.</p>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-background px-4 text-sm font-semibold hover:brightness-[0.98] disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" strokeWidth={1.75} />}
            Refresh feeds
          </button>
        </div>
      ) : (
        <ul className="[&>li+li]:border-t [&>li+li]:border-line">
          {signals.map((s) => (
            <li key={s.id} className="py-3">
              {s.sourceUrl ? (
                <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-semibold leading-snug hover:text-brand">
                  {s.title}
                </a>
              ) : (
                <span className="line-clamp-2 font-semibold leading-snug">{s.title}</span>
              )}
              <div className="mt-1 text-sm text-muted-foreground">
                {categoryLabel(s.category)} · {timeAgo(s.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
