"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

interface StatusSnapshot {
  running: boolean;
  totals: { healthy: number; stale: number; error: number };
  sources: Array<{ state: string }>;
}

export function SyncIndicator() {
  const [snap, setSnap] = useState<StatusSnapshot | null>(null);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/sync/status", { cache: "no-store" });
        const j = (await r.json()) as StatusSnapshot;
        if (live) setSnap(j);
      } catch {
        /* ignore */
      }
    };
    tick();
    const t = setInterval(tick, 20_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  if (!snap) return null;

  const inFlight = snap.sources.some((s) => s.state === "running");
  const hasError = snap.totals.error > 0;
  const hasStale = snap.totals.stale > 0;
  const dot = hasError ? "bg-red-500" : hasStale ? "bg-amber-400" : "bg-green-500";
  const title = hasError
    ? `${snap.totals.error} sync source(s) erroring`
    : hasStale
      ? `${snap.totals.stale} sync source(s) stale`
      : "All syncs healthy";

  return (
    <a
      href="/admin/system"
      className="flex h-8 items-center gap-1.5 px-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
      title={title}
    >
      {inFlight ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#D4A853]" />
      ) : (
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      )}
    </a>
  );
}
