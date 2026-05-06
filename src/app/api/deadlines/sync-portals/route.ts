import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchCards } from "@/lib/trello";
import { getSyncEngine } from "@/lib/sync-engine";

interface SyncResult {
  source: string;
  created: number;
  updated: number;
  errors: number;
}

async function upsertDeadline(
  userId: string,
  payload: {
    title: string;
    dueDate: Date;
    source: string;
    sourceRef: string;
    sourceUrl?: string;
    type: string;
    priority?: string;
    description?: string;
  }
): Promise<"created" | "updated"> {
  const existing = await prisma.deadline.findFirst({
    where: {
      assignedTo: userId,
      source: payload.source,
      sourceRef: payload.sourceRef,
    },
  });

  if (existing) {
    await prisma.deadline.update({
      where: { id: existing.id },
      data: {
        title: payload.title,
        dueDate: payload.dueDate,
        sourceUrl: payload.sourceUrl ?? existing.sourceUrl,
        description: payload.description ?? existing.description,
      },
    });
    return "updated";
  }

  await prisma.deadline.create({
    data: {
      title: payload.title,
      dueDate: payload.dueDate,
      source: payload.source,
      sourceRef: payload.sourceRef,
      sourceUrl: payload.sourceUrl ?? null,
      type: payload.type,
      priority: payload.priority ?? "MEDIUM",
      description: payload.description ?? null,
      assignedTo: userId,
      createdBy: "portal-sync",
    },
  });
  return "created";
}

async function syncTrello(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    source: "trello",
    created: 0,
    updated: 0,
    errors: 0,
  };
  try {
    const cards = await fetchCards();
    for (const card of cards) {
      if (!card.due) continue;
      try {
        const action = await upsertDeadline(userId, {
          title: card.name.slice(0, 200),
          dueDate: new Date(card.due),
          source: "trello",
          sourceRef: card.id,
          sourceUrl: card.url || card.shortUrl,
          type: "deliverable",
          description: card.desc?.slice(0, 500) ?? undefined,
        });
        if (action === "created") result.created++;
        else result.updated++;
      } catch {
        result.errors++;
      }
    }
  } catch (err) {
    console.error("Trello sync failed:", err);
    result.errors++;
  }
  return result;
}

async function syncProduction(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    source: "production",
    created: 0,
    updated: 0,
    errors: 0,
  };
  try {
    const productions = await prisma.production.findMany({
      where: { status: { notIn: ["ARCHIVED", "DELIVERED"] } },
    });
    for (const p of productions) {
      for (let i = 0; i < p.shootDates.length; i++) {
        const shoot = p.shootDates[i];
        if (!shoot) continue;
        try {
          const action = await upsertDeadline(userId, {
            title: `Shoot: ${p.title}`,
            dueDate: shoot,
            source: "production",
            sourceRef: `${p.id}:shoot:${i}`,
            sourceUrl: `/production/${p.id}`,
            type: "deliverable",
            priority: "HIGH",
            description: p.description ?? p.brief ?? undefined,
          });
          if (action === "created") result.created++;
          else result.updated++;
        } catch {
          result.errors++;
        }
      }
    }
  } catch (err) {
    console.error("Production sync failed:", err);
    result.errors++;
  }
  return result;
}

async function syncPrint(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    source: "print",
    created: 0,
    updated: 0,
    errors: 0,
  };
  try {
    const issues = await prisma.printIssue.findMany({
      where: { status: { notIn: ["archived", "complete"] } },
    });
    for (const issue of issues) {
      if (!issue.printDate) continue;
      try {
        const action = await upsertDeadline(userId, {
          title: `Print: ${issue.title}`,
          dueDate: issue.printDate,
          source: "print",
          sourceRef: `${issue.id}:print`,
          sourceUrl: `/print/${issue.id}`,
          type: "deliverable",
          priority: "HIGH",
          description: issue.printer ?? undefined,
        });
        if (action === "created") result.created++;
        else result.updated++;
      } catch {
        result.errors++;
      }
    }

    const editorialPieces = await prisma.editorialPiece.findMany({
      where: { deadline: { not: null }, status: { notIn: ["published", "archived"] } },
    });
    for (const piece of editorialPieces) {
      if (!piece.deadline) continue;
      try {
        const action = await upsertDeadline(userId, {
          title: `Editorial: ${piece.title}`,
          dueDate: piece.deadline,
          source: "print",
          sourceRef: `editorial:${piece.id}`,
          sourceUrl: `/editorial`,
          type: "deliverable",
          description: undefined,
        });
        if (action === "created") result.created++;
        else result.updated++;
      } catch {
        result.errors++;
      }
    }
  } catch (err) {
    console.error("Print sync failed:", err);
    result.errors++;
  }
  return result;
}

async function syncCampaignDeliverables(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    source: "task",
    created: 0,
    updated: 0,
    errors: 0,
  };
  try {
    const deliverables = await prisma.deliverable.findMany({
      where: { dueDate: { not: null }, completed: false },
      include: { campaign: { select: { id: true, title: true } } },
    });
    for (const d of deliverables) {
      if (!d.dueDate) continue;
      try {
        const action = await upsertDeadline(userId, {
          title: `${d.campaign.title}: ${d.type}`,
          dueDate: d.dueDate,
          source: "task",
          sourceRef: `deliverable:${d.id}`,
          sourceUrl: `/commercial/clients/${d.campaign.id}`,
          type: "deliverable",
          description: d.description ?? undefined,
        });
        if (action === "created") result.created++;
        else result.updated++;
      } catch {
        result.errors++;
      }
    }
  } catch (err) {
    console.error("Deliverables sync failed:", err);
    result.errors++;
  }
  return result;
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    let userId = session?.user?.id;
    if (!userId) {
      const fallback = await prisma.user.findFirst();
      if (!fallback) {
        return NextResponse.json({ error: "No user found" }, { status: 500 });
      }
      userId = fallback.id;
    }

    // Also kick the engine's deadline sync so cross-references update
    // and the auto-schedule timer is reset.
    try {
      await getSyncEngine().runOnce("deadlineSync");
    } catch (err) {
      console.warn("[sync-portals] engine deadlineSync failed:", err);
    }

    const results = await Promise.all([
      syncTrello(userId),
      syncProduction(userId),
      syncPrint(userId),
      syncCampaignDeliverables(userId),
    ]);

    const totalCreated = results.reduce((s, r) => s + r.created, 0);
    const totalUpdated = results.reduce((s, r) => s + r.updated, 0);

    return NextResponse.json({
      created: totalCreated,
      updated: totalUpdated,
      breakdown: results,
    });
  } catch (err) {
    console.error("POST /api/deadlines/sync-portals", err);
    return NextResponse.json(
      { error: "Failed to sync portals", detail: String(err) },
      { status: 500 }
    );
  }
}
