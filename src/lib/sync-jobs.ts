/**
 * Per-source sync jobs.
 * Each job pulls from one external source, runs the candidates through the
 * cross-reference engine, and returns a record count.
 */
import prisma from "./prisma";
import { buildSnapshot } from "./trello";
import { setCachedSnapshot, clearCachedSnapshot } from "./trello-cache";
import {
  batchUpsertDeadlines,
  reconcileMissing,
  linkTrelloCardsToProductions,
  linkProductionShootDatesToDeadlines,
  linkCampaignTimelinesToDeadlines,
  linkPrintMilestonesToDeadlines,
  type DeadlineCandidate,
} from "./cross-reference";

export interface SyncJobResult {
  records: number;
  detail: string;
}

/** Trello: cards with due dates → deadlines. Cards → productions cross-link. */
export async function syncTrello(): Promise<SyncJobResult> {
  clearCachedSnapshot();
  const snap = await buildSnapshot();
  setCachedSnapshot(snap);

  const candidates: DeadlineCandidate[] = [];
  const presentRefs: string[] = [];
  const allCards: Array<{ id: string; name: string; url?: string }> = [];

  for (const stage of snap.stages) {
    for (const card of stage.cards) {
      allCards.push({ id: card.id, name: card.name, url: card.url });
      if (!card.dueDate) continue;
      presentRefs.push(card.id);
      candidates.push({
        title: card.name,
        description: card.description,
        dueDate: new Date(card.dueDate),
        source: "trello",
        sourceRef: card.id,
        sourceUrl: card.url,
        type: "deliverable",
        priority: "MEDIUM",
        category: "commercial",
        rawData: { stage: stage.name, client: card.client, labels: card.labels },
      });
    }
  }

  const upsert = await batchUpsertDeadlines(candidates);
  const reconciled = await reconcileMissing("trello", presentRefs);
  const linked = await linkTrelloCardsToProductions(allCards);

  return {
    records: upsert.created + upsert.updated,
    detail: `cards: ${candidates.length}, created: ${upsert.created}, updated: ${upsert.updated}, completed: ${reconciled}, linked-to-prod: ${linked}`,
  };
}

/** Print: aggregate print issues' printDate + page assignments. */
export async function syncPrintSheet(): Promise<SyncJobResult> {
  const result = await linkPrintMilestonesToDeadlines();
  return {
    records: result.created + result.updated,
    detail: `print issues created: ${result.created}, updated: ${result.updated}`,
  };
}

/**
 * Email scan: derive deadlines from briefing inbox.
 * Best-effort — returns 0 records if Gmail tokens are absent.
 */
export async function syncEmailScan(): Promise<SyncJobResult> {
  const { google } = await import("googleapis");
  const { getToken } = await import("./token-store");
  const primaryToken = getToken("google_primary");
  if (!primaryToken) return { records: 0, detail: "no gmail token" };

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials(primaryToken as Parameters<typeof auth.setCredentials>[0]);
  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.messages.list({
    userId: "me",
    q: "(deadline OR due OR \"by friday\" OR \"by monday\") newer_than:14d",
    maxResults: 15,
  });

  const candidates: DeadlineCandidate[] = [];
  for (const msg of (res.data.messages ?? []).slice(0, 12)) {
    if (!msg.id) continue;
    try {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["Subject", "Date", "From"],
      });
      const headers = detail.data.payload?.headers ?? [];
      const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
      const dateStr = headers.find((h) => h.name === "Date")?.value;
      const from = headers.find((h) => h.name === "From")?.value ?? "";
      const due = dateStr ? new Date(dateStr) : new Date();
      due.setDate(due.getDate() + 7); // crude default
      candidates.push({
        title: subject,
        description: detail.data.snippet ?? undefined,
        dueDate: due,
        source: "email",
        sourceRef: msg.id,
        type: "deliverable",
        priority: "MEDIUM",
        category: "commercial",
        emailFrom: from.match(/<([^>]+)>/)?.[1] ?? from,
        emailSnippet: detail.data.snippet ?? undefined,
        threadId: detail.data.threadId ?? undefined,
      });
    } catch {
      /* skip individual failures */
    }
  }

  const upsert = await batchUpsertDeadlines(candidates);
  return {
    records: upsert.created + upsert.updated,
    detail: `emails scanned: ${candidates.length}, created: ${upsert.created}, updated: ${upsert.updated}`,
  };
}

/** RSS feeds — placeholder (no feed list configured yet). */
export async function syncRssFeeds(): Promise<SyncJobResult> {
  return { records: 0, detail: "no feeds configured" };
}

/**
 * Deadline sync: roll up production shoot dates + campaign timelines into deadlines.
 */
export async function syncDeadlines(): Promise<SyncJobResult> {
  const a = await linkProductionShootDatesToDeadlines();
  const b = await linkCampaignTimelinesToDeadlines();
  const created = a.created + b.created;
  const updated = a.updated + b.updated;
  return {
    records: created + updated,
    detail: `production shoots c:${a.created}/u:${a.updated}, campaign deliveries c:${b.created}/u:${b.updated}`,
  };
}

/** Cultural calendar — placeholder. */
export async function syncCulturalCalendar(): Promise<SyncJobResult> {
  return { records: 0, detail: "no source configured" };
}

/** Task intelligence — group related tasks & deadlines into smart projects. */
export async function syncIntelligence(): Promise<SyncJobResult> {
  const { analyzeAndGroupTasks } = await import("./ai-intelligence");
  const result = await analyzeAndGroupTasks();
  return {
    records: result.projectsCreated,
    detail: `projects created: ${result.projectsCreated}, items grouped: ${result.itemsGrouped}`,
  };
}

export type SyncSource =
  | "trello"
  | "printSheet"
  | "emailScan"
  | "rssFeeds"
  | "deadlineSync"
  | "culturalCalendar"
  | "intelligence";

export const SYNC_JOBS: Record<SyncSource, () => Promise<SyncJobResult>> = {
  trello: syncTrello,
  printSheet: syncPrintSheet,
  emailScan: syncEmailScan,
  rssFeeds: syncRssFeeds,
  deadlineSync: syncDeadlines,
  culturalCalendar: syncCulturalCalendar,
  intelligence: syncIntelligence,
};

export const SYNC_INTERVALS: Record<SyncSource, number> = {
  trello: 2 * 60 * 1000,
  printSheet: 5 * 60 * 1000,
  emailScan: 15 * 60 * 1000,
  rssFeeds: 30 * 60 * 1000,
  deadlineSync: 5 * 60 * 1000,
  culturalCalendar: 24 * 60 * 60 * 1000,
  intelligence: 6 * 60 * 60 * 1000,
};

export const SYNC_LABELS: Record<SyncSource, string> = {
  trello: "Trello",
  printSheet: "Print Sheet",
  emailScan: "Email Scan",
  rssFeeds: "RSS Feeds",
  deadlineSync: "Deadline Sync",
  culturalCalendar: "Cultural Calendar",
  intelligence: "Task Intelligence",
};

// Used by /api/sync/status to compute "stale" thresholds.
export function isStale(lastSyncAt: Date | null, intervalMs: number): boolean {
  if (!lastSyncAt) return true;
  return Date.now() - lastSyncAt.getTime() > intervalMs * 2;
}

export async function recordRunStart(source: SyncSource): Promise<string> {
  const log = await prisma.syncLog.create({
    data: { source, ok: false },
    select: { id: true },
  });
  await prisma.syncStatus.upsert({
    where: { source },
    update: { state: "running", lastSyncAt: new Date() },
    create: {
      source,
      state: "running",
      intervalMs: SYNC_INTERVALS[source],
      lastSyncAt: new Date(),
    },
  });
  return log.id;
}

export async function recordRunFinish(
  source: SyncSource,
  logId: string,
  ok: boolean,
  result: SyncJobResult | null,
  error: string | null,
  startedAt: number
): Promise<void> {
  const finishedAt = new Date();
  const durationMs = Date.now() - startedAt;
  await prisma.syncLog.update({
    where: { id: logId },
    data: {
      finishedAt,
      durationMs,
      ok,
      recordCount: result?.records ?? 0,
      message: error ?? result?.detail ?? null,
    },
  });
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const errorCount24h = await prisma.syncLog.count({
    where: { source, ok: false, startedAt: { gte: since24h } },
  });
  await prisma.syncStatus.update({
    where: { source },
    data: {
      state: ok ? "idle" : "error",
      lastError: error,
      lastSuccessAt: ok ? finishedAt : undefined,
      nextSyncAt: new Date(Date.now() + SYNC_INTERVALS[source]),
      errorCount24h,
      recordsSynced: { increment: result?.records ?? 0 },
      totalRuns: { increment: 1 },
    },
  });
}
