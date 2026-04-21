"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Zap,
  Clock,
  TrendingUp,
  Activity,
  XCircle,
  Info,
} from "lucide-react";

interface SyncStats {
  runId: string;
  completedAt: string;
  campaignsAnalyzed: number;
  updatesApplied: number;
  flagsRaised: number;
  errors: number;
}

interface SyncReport extends SyncStats {
  startedAt: string;
  durationMs: number;
  summary: string[];
}

interface LogEntry {
  id: string;
  runId: string;
  campaignId: string | null;
  type: string;
  finding: string;
  action: string | null;
  confidence: number;
  sources: string[];
  createdAt: string;
  campaign: {
    id: string;
    title: string;
    status: string;
    client: { name: string };
  } | null;
  rawData?: {
    findings?: string[];
    flags?: string[];
    emailCount?: number;
  };
}

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  status_update: {
    label: "Status Update",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    icon: TrendingUp,
  },
  io_signed: {
    label: "IO Signed",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    icon: CheckCircle,
  },
  value_update: {
    label: "Value Update",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    icon: Zap,
  },
  flag: {
    label: "Flag",
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
    icon: AlertTriangle,
  },
  no_change: {
    label: "No Change",
    color: "text-gray-500",
    bg: "bg-gray-50 border-gray-200",
    icon: Info,
  },
  error: {
    label: "Error",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    icon: XCircle,
  },
};

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ConfidencePip({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 85 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-gray-300";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-400">{pct}%</span>
    </div>
  );
}

export default function EngineRoomPage() {
  const [syncing, setSyncing] = useState(false);
  const [lastStats, setLastStats] = useState<SyncStats | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch("/api/engine/sync"),
        fetch("/api/engine/logs?limit=60"),
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setLastStats(data.stats);
        setLastRun(data.lastRun);
      }
      if (logsRes.ok) {
        setLogs(await logsRes.json());
      }
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function runSync() {
    setSyncing(true);
    setLastReport(null);
    try {
      const res = await fetch("/api/engine/sync", { method: "POST" });
      if (res.ok) {
        const report: SyncReport = await res.json();
        setLastReport(report);
        await loadStatus();
      }
    } finally {
      setSyncing(false);
    }
  }

  const filters = [
    { key: "all", label: "All" },
    { key: "status_update", label: "Updates" },
    { key: "flag", label: "Flags" },
    { key: "io_signed", label: "IO Signed" },
    { key: "no_change", label: "No Change" },
    { key: "error", label: "Errors" },
  ];

  const filteredLogs =
    activeFilter === "all" ? logs : logs.filter((l) => l.type === activeFilter);

  const updateCount = logs.filter((l) =>
    ["status_update", "io_signed", "value_update"].includes(l.type)
  ).length;
  const flagCount = logs.filter((l) => l.type === "flag").length;
  const noChangeCount = logs.filter((l) => l.type === "no_change").length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Engine Room</h1>
          <p className="text-xs text-gray-500">
            AI deal intelligence — emails + Xero → campaign database
          </p>
        </div>
        <button
          onClick={runSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg bg-[#D4A853] px-4 py-2 text-sm font-medium text-white hover:bg-[#C49843] disabled:opacity-60 transition-colors"
        >
          {syncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {syncing ? "Running sync…" : "Run Sync Now"}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Status strip */}
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
          <Activity
            className={`h-4 w-4 ${
              syncing ? "text-amber-500 animate-pulse" : "text-gray-400"
            }`}
          />
          <span className="text-gray-500">
            {syncing
              ? "Sync in progress — analysing campaigns against Gmail and Xero…"
              : lastRun
              ? `Last sync ${timeAgo(lastRun)}`
              : "No sync run yet — click Run Sync Now to start the engine"}
          </span>
          {lastStats && !syncing && (
            <span className="ml-auto text-xs text-gray-400">
              {lastStats.campaignsAnalyzed} campaigns · {lastStats.updatesApplied}{" "}
              updates · {lastStats.flagsRaised} flags
            </span>
          )}
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Auto-updates",
              value: updateCount,
              icon: TrendingUp,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              label: "Flags for review",
              value: flagCount,
              icon: AlertTriangle,
              color: "text-orange-500",
              bg: "bg-orange-50",
            },
            {
              label: "No change",
              value: noChangeCount,
              icon: CheckCircle,
              color: "text-gray-500",
              bg: "bg-gray-100",
            },
            {
              label: "Last run",
              value: lastReport ? `${(lastReport.durationMs / 1000).toFixed(1)}s` : "—",
              icon: Clock,
              color: "text-blue-600",
              bg: "bg-blue-50",
            },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <div
                  className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg}`}
                >
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-xs text-gray-500">{kpi.label}</p>
              </div>
            );
          })}
        </div>

        {/* Last sync report */}
        {lastReport && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-emerald-800">
                Sync complete — {(lastReport.durationMs / 1000).toFixed(1)}s
              </p>
              <span className="text-xs text-emerald-600">
                {lastReport.updatesApplied} updates · {lastReport.flagsRaised} flags
              </span>
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {lastReport.summary.map((line, i) => (
                <p key={i} className="text-xs text-emerald-700">
                  {line}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Intelligence log */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Intelligence Log
            </h2>
            <div className="flex gap-1 flex-wrap">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                    activeFilter === f.key
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {loadingLogs ? (
              <div className="p-8 text-center text-xs text-gray-400">
                Loading…
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center">
                <Zap className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-400">
                  {logs.length === 0
                    ? "No syncs run yet. Click 'Run Sync Now' to start the engine."
                    : "No entries for this filter."}
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const cfg = TYPE_CONFIG[log.type] ?? TYPE_CONFIG.no_change;
                const Icon = cfg.icon;
                const isExpanded = expandedId === log.id;

                return (
                  <div key={log.id} className="px-4 py-3">
                    <div
                      className="flex cursor-pointer items-start gap-3"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : log.id)
                      }
                    >
                      <div
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${cfg.bg}`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-gray-900">
                            {log.campaign?.client.name ?? "—"}
                          </span>
                          {log.campaign && (
                            <span className="truncate text-xs text-gray-400">
                              {log.campaign.title}
                            </span>
                          )}
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}
                          >
                            {cfg.label}
                          </span>
                          {log.sources.map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500"
                            >
                              {s}
                            </span>
                          ))}
                          <span className="ml-auto shrink-0 text-[10px] text-gray-400">
                            {timeAgo(log.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs leading-snug text-gray-600">
                          {log.finding}
                        </p>
                        {log.action && (
                          <p className="mt-0.5 text-xs font-medium text-emerald-700">
                            → {log.action}
                          </p>
                        )}
                        <div className="mt-1">
                          <ConfidencePip value={log.confidence} />
                        </div>
                      </div>
                    </div>

                    {isExpanded && log.rawData && (
                      <div className="ml-9 mt-3 space-y-2 rounded-lg bg-gray-50 p-3 text-xs">
                        {log.rawData.emailCount !== undefined && (
                          <p className="text-gray-500">
                            Emails scanned:{" "}
                            <span className="font-medium">{log.rawData.emailCount}</span>
                          </p>
                        )}
                        {(log.rawData.findings ?? []).length > 0 && (
                          <div>
                            <p className="mb-1 font-semibold text-gray-600">
                              Findings:
                            </p>
                            {(log.rawData.findings ?? []).map((f, i) => (
                              <p key={i} className="text-gray-500">
                                • {f}
                              </p>
                            ))}
                          </div>
                        )}
                        {(log.rawData.flags ?? []).length > 0 && (
                          <div>
                            <p className="mb-1 font-semibold text-orange-600">
                              Flags:
                            </p>
                            {(log.rawData.flags ?? []).map((f, i) => (
                              <p key={i} className="text-orange-500">
                                ⚑ {f}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
