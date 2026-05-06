"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface SourceStatus {
  source: string;
  label: string;
  intervalMs: number;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  nextSyncAt: string | null;
  state: "idle" | "running" | "error" | "stale";
  lastError: string | null;
  errorCount24h: number;
  recordsSynced: number;
  totalRuns: number;
  health: "healthy" | "stale" | "error";
}

interface StatusResponse {
  running: boolean;
  sources: SourceStatus[];
  totals: {
    recordsLast24h: number;
    sources: number;
    healthy: number;
    stale: number;
    error: number;
  };
}

function relative(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function intervalLabel(ms: number): string {
  if (ms < 3_600_000) return `every ${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `every ${Math.round(ms / 3_600_000)}h`;
  return `every ${Math.round(ms / 86_400_000)}d`;
}

function dotClass(health: SourceStatus["health"]): string {
  if (health === "healthy") return "bg-green-500";
  if (health === "stale") return "bg-amber-400";
  return "bg-red-500";
}

export function SyncHealthPanel() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/sync/status", { cache: "no-store" });
      const j = (await r.json()) as StatusResponse;
      setData(j);
    } catch {
      /* leave previous data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  const trigger = useCallback(
    async (source: string | null) => {
      setBusy(source ?? "all");
      try {
        const url = source ? `/api/sync/trigger?source=${source}` : "/api/sync/trigger";
        await fetch(url, { method: "POST" });
        await refresh();
      } finally {
        setBusy(null);
      }
    },
    [refresh]
  );

  if (loading && !data) {
    return (
      <div className="text-xs text-gray-400">Loading sync status…</div>
    );
  }
  if (!data) {
    return <div className="text-xs text-red-500">Sync status unavailable.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            Engine:{" "}
            <span className={data.running ? "text-green-600 font-semibold" : "text-gray-400"}>
              {data.running ? "running" : "stopped"}
            </span>
          </span>
          <span>·</span>
          <span>{data.totals.healthy} healthy</span>
          {data.totals.stale > 0 && <span className="text-amber-600">{data.totals.stale} stale</span>}
          {data.totals.error > 0 && <span className="text-red-600">{data.totals.error} error</span>}
          <span>·</span>
          <span>{data.totals.recordsLast24h} records last 24h</span>
        </div>
        <button
          onClick={() => trigger(null)}
          disabled={busy !== null}
          className="text-xs font-semibold text-[#D4A853] hover:text-amber-700 disabled:opacity-50 flex items-center gap-1"
        >
          <RefreshCw size={12} className={busy === "all" ? "animate-spin" : ""} />
          Sync All
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.sources.map((s) => (
          <div
            key={s.source}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${dotClass(s.health)}`} />
                <span className="text-sm font-semibold text-gray-900">{s.label}</span>
              </div>
              {s.state === "running" ? (
                <RefreshCw size={12} className="text-amber-400 animate-spin" />
              ) : s.health === "error" ? (
                <AlertTriangle size={12} className="text-red-500" />
              ) : s.health === "stale" ? (
                <Clock size={12} className="text-amber-400" />
              ) : (
                <CheckCircle2 size={12} className="text-green-500" />
              )}
            </div>
            <dl className="space-y-0.5 text-[11px] text-gray-500">
              <div className="flex justify-between">
                <dt>Last sync</dt>
                <dd className="text-gray-700">{relative(s.lastSyncAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Schedule</dt>
                <dd className="text-gray-700">{intervalLabel(s.intervalMs)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Records</dt>
                <dd className="text-gray-700">{s.recordsSynced}</dd>
              </div>
              {s.errorCount24h > 0 && (
                <div className="flex justify-between text-red-600">
                  <dt>Errors (24h)</dt>
                  <dd>{s.errorCount24h}</dd>
                </div>
              )}
            </dl>
            {s.lastError && (
              <p className="mt-2 text-[10px] text-red-500 truncate" title={s.lastError}>
                {s.lastError}
              </p>
            )}
            <button
              onClick={() => trigger(s.source)}
              disabled={busy !== null}
              className="mt-3 w-full text-[11px] font-medium border border-gray-200 rounded-lg py-1.5 hover:border-[#D4A853] hover:text-[#D4A853] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <RefreshCw size={10} className={busy === s.source ? "animate-spin" : ""} />
              Sync Now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
