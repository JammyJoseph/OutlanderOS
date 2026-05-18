/**
 * Sync Engine — singleton orchestrator that schedules each source.
 *
 * Each source runs on its own setInterval; one failed sync does not affect
 * the others. Status is persisted via SyncStatus + SyncLog so it survives
 * a server restart and is visible to the System Health UI.
 */
import {
  SYNC_INTERVALS,
  SYNC_JOBS,
  type SyncSource,
  recordRunStart,
  recordRunFinish,
} from "./sync-jobs";
import { logger } from "./logger";

interface RunningJob {
  timer: NodeJS.Timeout;
  inFlight: boolean;
}

class SyncEngine {
  private jobs = new Map<SyncSource, RunningJob>();
  private started = false;

  isRunning(): boolean {
    return this.started;
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    (Object.keys(SYNC_INTERVALS) as SyncSource[]).forEach((source) => {
      this.scheduleSource(source);
    });

    const summary = (Object.keys(SYNC_INTERVALS) as SyncSource[])
      .map((s) => `${s} (${Math.round(SYNC_INTERVALS[s] / 60000)}min)`)
      .join(", ");
    logger.info("sync-engine", `started — ${summary}`);
  }

  stop(): void {
    if (!this.started) return;
    for (const [, job] of this.jobs) clearInterval(job.timer);
    this.jobs.clear();
    this.started = false;
    logger.info("sync-engine", "stopped");
  }

  private scheduleSource(source: SyncSource): void {
    const interval = SYNC_INTERVALS[source];
    const tick = () => {
      this.runOnce(source).catch((err) => {
        logger.error("sync-engine", `${source} tick failed`, err);
      });
    };
    // initial delayed kick to let the server boot finish
    const initial = setTimeout(tick, 5_000 + Math.random() * 5_000);
    const timer = setInterval(tick, interval);
    // unref so they don't block process exit in dev
    (initial as unknown as { unref?: () => void }).unref?.();
    (timer as unknown as { unref?: () => void }).unref?.();
    this.jobs.set(source, { timer, inFlight: false });
  }

  /**
   * Run a single sync now. Returns the result or throws on error.
   * Manual triggers should call this — it also resets the interval timer
   * so the next auto-sync is pushed back.
   */
  async runOnce(source: SyncSource): Promise<{ ok: boolean; records: number; detail: string }> {
    const job = this.jobs.get(source);
    if (job?.inFlight) {
      return { ok: false, records: 0, detail: "already running" };
    }
    if (job) job.inFlight = true;

    const startedAt = Date.now();
    let logId: string | null = null;
    try {
      logger.info("sync-engine", `${source} sync started`);
      logId = await recordRunStart(source);
      const result = await SYNC_JOBS[source]();
      await recordRunFinish(source, logId, true, result, null, startedAt);
      this.resetTimer(source);
      logger.info("sync-engine", `${source} sync finished`, {
        records: result.records,
        durationMs: Date.now() - startedAt,
      });
      return { ok: true, records: result.records, detail: result.detail };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("sync-engine", `${source} sync failed`, message);
      if (logId) {
        try {
          await recordRunFinish(source, logId, false, null, message, startedAt);
        } catch (logErr) {
          logger.error("sync-engine", "failed to record failure", logErr);
        }
      }
      return { ok: false, records: 0, detail: message };
    } finally {
      if (job) job.inFlight = false;
    }
  }

  private resetTimer(source: SyncSource): void {
    const job = this.jobs.get(source);
    if (!job) return;
    clearInterval(job.timer);
    const interval = SYNC_INTERVALS[source];
    const timer = setInterval(() => {
      this.runOnce(source).catch((err) => {
        logger.error("sync-engine", `${source} tick failed`, err);
      });
    }, interval);
    (timer as unknown as { unref?: () => void }).unref?.();
    this.jobs.set(source, { timer, inFlight: job.inFlight });
  }
}

const globalForEngine = globalThis as unknown as { __syncEngine?: SyncEngine };

export function getSyncEngine(): SyncEngine {
  if (!globalForEngine.__syncEngine) {
    globalForEngine.__syncEngine = new SyncEngine();
  }
  return globalForEngine.__syncEngine;
}
