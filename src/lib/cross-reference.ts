/**
 * Cross-Reference Engine
 *
 * Deduplicates incoming records and connects data across portals.
 * Every external sync flows through here before hitting the database.
 */
import prisma from "./prisma";

export interface DeadlineCandidate {
  title: string;
  description?: string;
  dueDate: Date;
  source: string;        // trello | production | print | task | manual | email | calendar | campaign
  sourceRef?: string;    // external id
  sourceUrl?: string;
  type?: string;         // deliverable | review | meeting | invoice
  priority?: string;     // LOW | MEDIUM | HIGH | URGENT
  category?: string;     // commercial | production | print | editorial | finance | personal
  assignedTo?: string | null;
  emailFrom?: string;
  emailSnippet?: string;
  threadId?: string;
  linkedType?: string;
  linkedId?: string;
  rawData?: unknown;
}

export interface UpsertResult {
  created: number;
  updated: number;
  unchanged: number;
}

function normaliseTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function dayDiff(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86400000;
}

let cachedFallbackUserId: string | null | undefined = undefined;
async function fallbackUserId(): Promise<string | null> {
  if (cachedFallbackUserId !== undefined) return cachedFallbackUserId;
  const u = await prisma.user.findFirst({ select: { id: true } });
  cachedFallbackUserId = u?.id ?? null;
  return cachedFallbackUserId;
}

/**
 * Upsert a deadline using the dedup hierarchy:
 *   1. exact (source, sourceRef) match → update
 *   2. fuzzy title + ±2 day match (same source) → update
 *   3. same threadId (any source) → update with newer info
 *   4. otherwise → create
 */
export async function upsertDeadline(
  c: DeadlineCandidate
): Promise<{ action: "created" | "updated" | "unchanged"; id: string }> {
  // 1. exact source+sourceRef match
  if (c.sourceRef) {
    const existing = await prisma.deadline.findUnique({
      where: { source_sourceRef: { source: c.source, sourceRef: c.sourceRef } },
    });
    if (existing) {
      const changed =
        existing.title !== c.title ||
        existing.dueDate.getTime() !== c.dueDate.getTime() ||
        existing.description !== (c.description ?? null) ||
        existing.linkedType !== (c.linkedType ?? null) ||
        existing.linkedId !== (c.linkedId ?? null);
      if (!changed) return { action: "unchanged", id: existing.id };
      const updated = await prisma.deadline.update({
        where: { id: existing.id },
        data: {
          title: c.title,
          description: c.description ?? existing.description,
          dueDate: c.dueDate,
          priority: c.priority ?? existing.priority,
          category: c.category ?? existing.category,
          sourceUrl: c.sourceUrl ?? existing.sourceUrl,
          linkedType: c.linkedType ?? existing.linkedType,
          linkedId: c.linkedId ?? existing.linkedId,
          threadId: c.threadId ?? existing.threadId,
          emailFrom: c.emailFrom ?? existing.emailFrom,
          emailSnippet: c.emailSnippet ?? existing.emailSnippet,
          rawData: (c.rawData as object) ?? undefined,
        },
      });
      return { action: "updated", id: updated.id };
    }
  }

  // 2. fuzzy title + date proximity (same source)
  const fuzzyCandidates = await prisma.deadline.findMany({
    where: {
      source: c.source,
      dueDate: {
        gte: new Date(c.dueDate.getTime() - 2 * 86400000),
        lte: new Date(c.dueDate.getTime() + 2 * 86400000),
      },
    },
    take: 20,
  });
  const targetNorm = normaliseTitle(c.title);
  const fuzzyMatch = fuzzyCandidates.find((d) => {
    const dn = normaliseTitle(d.title);
    if (!dn || !targetNorm) return false;
    return dn === targetNorm || dn.includes(targetNorm) || targetNorm.includes(dn);
  });
  if (fuzzyMatch && dayDiff(fuzzyMatch.dueDate, c.dueDate) <= 2) {
    const updated = await prisma.deadline.update({
      where: { id: fuzzyMatch.id },
      data: {
        title: c.title,
        description: c.description ?? fuzzyMatch.description,
        dueDate: c.dueDate,
        sourceRef: c.sourceRef ?? fuzzyMatch.sourceRef,
        sourceUrl: c.sourceUrl ?? fuzzyMatch.sourceUrl,
        linkedType: c.linkedType ?? fuzzyMatch.linkedType,
        linkedId: c.linkedId ?? fuzzyMatch.linkedId,
        rawData: (c.rawData as object) ?? undefined,
      },
    });
    return { action: "updated", id: updated.id };
  }

  // 3. email thread match
  if (c.threadId) {
    const threadMatch = await prisma.deadline.findFirst({
      where: { threadId: c.threadId },
      orderBy: { updatedAt: "desc" },
    });
    if (threadMatch) {
      const updated = await prisma.deadline.update({
        where: { id: threadMatch.id },
        data: {
          title: c.title,
          description: c.description ?? threadMatch.description,
          dueDate: c.dueDate,
          rawData: (c.rawData as object) ?? undefined,
        },
      });
      return { action: "updated", id: updated.id };
    }
  }

  // 4. create
  const assignedTo = c.assignedTo === undefined ? await fallbackUserId() : c.assignedTo;
  const created = await prisma.deadline.create({
    data: {
      title: c.title,
      description: c.description,
      dueDate: c.dueDate,
      source: c.source,
      sourceRef: c.sourceRef,
      sourceUrl: c.sourceUrl,
      type: c.type ?? "deliverable",
      priority: c.priority ?? "MEDIUM",
      category: c.category,
      assignedTo: assignedTo ?? null,
      createdBy: "sync-engine",
      emailFrom: c.emailFrom,
      emailSnippet: c.emailSnippet,
      threadId: c.threadId,
      linkedType: c.linkedType,
      linkedId: c.linkedId,
      rawData: (c.rawData as object) ?? undefined,
    },
  });
  return { action: "created", id: created.id };
}

export async function batchUpsertDeadlines(
  candidates: DeadlineCandidate[]
): Promise<UpsertResult> {
  const result: UpsertResult = { created: 0, updated: 0, unchanged: 0 };
  for (const c of candidates) {
    try {
      const r = await upsertDeadline(c);
      if (r.action === "created") result.created++;
      else if (r.action === "updated") result.updated++;
      else result.unchanged++;
    } catch (err) {
      console.error("[cross-ref] upsertDeadline failed:", err);
    }
  }
  return result;
}

/**
 * Mark deadlines as completed when their source has disappeared.
 * For a given (source, presentRefs), any non-present open deadline
 * is marked complete rather than deleted.
 */
export async function reconcileMissing(
  source: string,
  presentRefs: string[]
): Promise<number> {
  const orphaned = await prisma.deadline.findMany({
    where: {
      source,
      sourceRef: { notIn: presentRefs.length ? presentRefs : ["__none__"] },
      status: { in: ["ACTIVE", "OPEN", "IN_PROGRESS"] },
    },
  });
  if (!orphaned.length) return 0;
  await prisma.deadline.updateMany({
    where: { id: { in: orphaned.map((o) => o.id) } },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  return orphaned.length;
}

/**
 * Cross-portal connections — runs after a sync finishes.
 * Stores associations in CrossLink so portals can render relationships.
 */
export async function linkTrelloCardsToProductions(
  cards: Array<{ id: string; name: string; url?: string }>
): Promise<number> {
  if (!cards.length) return 0;
  const productions = await prisma.production.findMany({
    select: { id: true, title: true, clientName: true },
  });
  let linked = 0;
  for (const card of cards) {
    const cardName = normaliseTitle(card.name);
    const match = productions.find((p) => {
      const cn = normaliseTitle(p.clientName ?? "");
      const pt = normaliseTitle(p.title);
      return (
        (cn && (cardName.includes(cn) || cn.includes(cardName))) ||
        (pt && (cardName.includes(pt) || pt.includes(cardName)))
      );
    });
    if (!match) continue;
    try {
      await prisma.crossLink.upsert({
        where: {
          fromType_fromId_toType_toId: {
            fromType: "trello",
            fromId: card.id,
            toType: "production",
            toId: match.id,
          },
        },
        update: { reason: "name match" },
        create: {
          fromType: "trello",
          fromId: card.id,
          toType: "production",
          toId: match.id,
          reason: "name match",
        },
      });
      linked++;
    } catch (err) {
      console.error("[cross-ref] linkTrelloCardsToProductions:", err);
    }
  }
  return linked;
}

export async function linkProductionShootDatesToDeadlines(): Promise<UpsertResult> {
  const productions = await prisma.production.findMany({
    where: { shootDates: { isEmpty: false } },
    select: { id: true, title: true, clientName: true, shootDates: true, leadId: true },
  });
  const candidates: DeadlineCandidate[] = [];
  for (const p of productions) {
    for (let i = 0; i < p.shootDates.length; i++) {
      const d = p.shootDates[i];
      candidates.push({
        title: `Shoot: ${p.title}${p.clientName ? ` (${p.clientName})` : ""}`,
        dueDate: d,
        source: "production",
        sourceRef: `${p.id}:shoot:${i}`,
        sourceUrl: `/production/${p.id}`,
        type: "deliverable",
        priority: "HIGH",
        category: "production",
        linkedType: "production",
        linkedId: p.id,
        assignedTo: p.leadId ?? undefined,
      });
    }
  }
  return batchUpsertDeadlines(candidates);
}

export async function linkCampaignTimelinesToDeadlines(): Promise<UpsertResult> {
  const campaigns = await prisma.campaign.findMany({
    where: {
      timelineEnd: { not: null },
      status: { notIn: ["DELIVERED", "PAID", "ARCHIVED"] },
    },
    select: {
      id: true,
      title: true,
      timelineEnd: true,
      createdById: true,
      client: { select: { name: true } },
    },
  });
  const candidates: DeadlineCandidate[] = campaigns
    .filter((c) => c.timelineEnd)
    .map((c) => ({
      title: `Campaign delivery: ${c.title} (${c.client.name})`,
      dueDate: c.timelineEnd!,
      source: "campaign",
      sourceRef: c.id,
      sourceUrl: `/commercial/clients/${c.id}`,
      type: "deliverable",
      priority: "HIGH",
      category: "commercial",
      linkedType: "campaign",
      linkedId: c.id,
      assignedTo: c.createdById,
    }));
  return batchUpsertDeadlines(candidates);
}

export async function linkPrintMilestonesToDeadlines(): Promise<UpsertResult> {
  const issues = await prisma.printIssue.findMany({
    where: { printDate: { not: null } },
    select: { id: true, title: true, year: true, printDate: true },
  });
  const candidates: DeadlineCandidate[] = issues
    .filter((i) => i.printDate)
    .map((i) => ({
      title: `Print deadline: ${i.title} ${i.year}`,
      dueDate: i.printDate!,
      source: "print",
      sourceRef: `${i.id}:print`,
      sourceUrl: `/print/${i.id}`,
      type: "deliverable",
      priority: "HIGH",
      category: "print",
      linkedType: "printIssue",
      linkedId: i.id,
    }));

  // Timeline milestones from the print Google Sheet — upcoming only.
  try {
    const { fetchPrintTimelineMilestones } = await import("./print-sheet");
    const milestones = await fetchPrintTimelineMilestones();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (const m of milestones) {
      if (m.date < now) continue;
      const ref = `sheet:${m.issue}:${normaliseTitle(m.label)}`.slice(0, 180);
      candidates.push({
        title: `Print: ${m.label} — ${m.issue}`,
        dueDate: m.date,
        source: "print",
        sourceRef: ref,
        sourceUrl: `/print`,
        type: "deliverable",
        priority: "HIGH",
        category: "print",
      });
    }
  } catch (err) {
    console.error("[cross-ref] print timeline milestones failed:", err);
  }

  return batchUpsertDeadlines(candidates);
}
