"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";

interface Digest {
  greeting: string;
  briefing: string;
  stats: { overdue: number; dueToday: number; dueThisWeek: number; projectsActive: number };
  highlights: string[];
  generatedAt: string;
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="px-4 py-3 text-center">
      <p className={`text-2xl font-bold ${accent ? "text-red-500" : "text-gray-900"}`}>{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
    </div>
  );
}

export function DailyDigestCard() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/intelligence/digest", { method: "POST" });
      if (res.ok) setDigest(await res.json());
    } catch {
      // silent — the dashboard still works without the digest
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white">
      <div className="flex items-start justify-between p-5">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-purple-500">
              Daily Digest
            </span>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-5 w-64 animate-pulse rounded bg-purple-100" />
              <div className="h-4 w-full max-w-lg animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-3/4 max-w-md animate-pulse rounded bg-gray-100" />
            </div>
          ) : digest ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900">{digest.greeting}</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-600">
                {digest.briefing}
              </p>
              {digest.highlights.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {digest.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {h}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">Couldn&apos;t generate your digest right now.</p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="ml-4 flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Regenerate
        </button>
      </div>
      {digest && !loading && (
        <div className="grid grid-cols-4 divide-x divide-purple-100 border-t border-purple-100 bg-white/60">
          <Stat label="Overdue" value={digest.stats.overdue} accent={digest.stats.overdue > 0} />
          <Stat label="Due Today" value={digest.stats.dueToday} />
          <Stat label="This Week" value={digest.stats.dueThisWeek} />
          <Stat label="Projects" value={digest.stats.projectsActive} />
        </div>
      )}
    </div>
  );
}
