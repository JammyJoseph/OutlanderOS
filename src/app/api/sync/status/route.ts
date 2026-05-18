import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSyncEngine } from "@/lib/sync-engine";
import {
  SYNC_INTERVALS,
  SYNC_LABELS,
  isStale,
  type SyncSource,
} from "@/lib/sync-jobs";
import { withAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface SourceStatus {
  source: SyncSource;
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

export const GET = withAdmin(async () => {
  const engine = getSyncEngine();
  const sources = Object.keys(SYNC_INTERVALS) as SyncSource[];
  const rows = await prisma.syncStatus.findMany({
    where: { source: { in: sources } },
  });
  const map = new Map(rows.map((r) => [r.source, r]));

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const totalRecords = await prisma.syncLog.aggregate({
    _sum: { recordCount: true },
    where: { ok: true, startedAt: { gte: since24h } },
  });

  const statuses: SourceStatus[] = sources.map((source) => {
    const r = map.get(source);
    const intervalMs = SYNC_INTERVALS[source];
    const lastSyncAt = r?.lastSyncAt ?? null;
    let health: SourceStatus["health"] = "healthy";
    if (r?.state === "error" || (r?.errorCount24h ?? 0) > 0) health = "error";
    else if (isStale(lastSyncAt, intervalMs)) health = "stale";

    return {
      source,
      label: SYNC_LABELS[source],
      intervalMs,
      lastSyncAt: lastSyncAt?.toISOString() ?? null,
      lastSuccessAt: r?.lastSuccessAt?.toISOString() ?? null,
      nextSyncAt: r?.nextSyncAt?.toISOString() ?? null,
      state: (r?.state as SourceStatus["state"]) ?? "idle",
      lastError: r?.lastError ?? null,
      errorCount24h: r?.errorCount24h ?? 0,
      recordsSynced: r?.recordsSynced ?? 0,
      totalRuns: r?.totalRuns ?? 0,
      health,
    };
  });

  return NextResponse.json({
    running: engine.isRunning(),
    sources: statuses,
    totals: {
      recordsLast24h: totalRecords._sum.recordCount ?? 0,
      sources: statuses.length,
      healthy: statuses.filter((s) => s.health === "healthy").length,
      stale: statuses.filter((s) => s.health === "stale").length,
      error: statuses.filter((s) => s.health === "error").length,
    },
  });
});
