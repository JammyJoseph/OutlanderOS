import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import {
  PIPELINE_STAGES,
  ACTIVE_STAGES,
  normalizeStage,
  type DealStageValue,
} from "@/lib/deal-stages";

// GET /api/commercial/dashboard
//
// One-shot payload for the Commercial operations dashboard: headline metrics,
// every active job (with client + stage + linked production status), per-stage
// counts, a universal campaign calendar (shoots, content live dates, brief
// deadlines, payment due dates) and a cross-portal recent-activity feed.
export const GET = withAuth(async () => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { archived: false, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        title: true,
        stage: true,
        stageUpdatedAt: true,
        value: true,
        type: true,
        dealTypes: true,
        workflowType: true,
        jobType: true,
        dueDate: true,
        briefDueDate: true,
        createdAt: true,
        updatedAt: true,
        client: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        production: {
          select: {
            id: true,
            status: true,
            shootDates: true,
            budgetTotal: true,
            budgetActual: true,
            updatedAt: true,
          },
        },
        deliverables: {
          select: { id: true, title: true, type: true, dueDate: true, scheduleStatus: true, postedUrl: true },
        },
      },
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const isActive = (stage: string) => (ACTIVE_STAGES as string[]).includes(stage);

    // ── Active jobs (everything not completed/paid) ──
    const activeDealsRaw = campaigns.filter((c) => isActive(c.stage));

    const activeDeals = activeDealsRaw.map((c) => {
      const ns = normalizeStage(c.stage);
      const nextShoot =
        (c.production?.shootDates ?? [])
          .map((d) => new Date(d))
          .filter((d) => d.getTime() >= now.getTime())
          .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
      return {
        id: c.id,
        title: c.title,
        client: c.client,
        stage: ns,
        jobType: c.jobType,
        workflowType: c.workflowType,
        type: c.type,
        dealTypes: c.dealTypes,
        value: c.value,
        dueDate: c.dueDate,
        briefDueDate: c.briefDueDate,
        stageUpdatedAt: c.stageUpdatedAt ?? c.createdAt,
        updatedAt: c.updatedAt,
        assignedTo: c.assignedTo,
        production: c.production
          ? {
              id: c.production.id,
              status: c.production.status,
              nextShoot: nextShoot ? nextShoot.toISOString() : null,
              budgetTotal: c.production.budgetTotal,
              budgetActual: c.production.budgetActual,
              updatedAt: c.production.updatedAt,
            }
          : null,
      };
    });

    // ── Headline metrics ──
    const pipelineValue = activeDealsRaw.reduce((sum, d) => sum + (d.value ?? 0), 0);
    const inProduction = activeDealsRaw.filter((d) => normalizeStage(d.stage) === "IN_PRODUCTION").length;
    const completedThisMonth = campaigns.filter(
      (d) =>
        ["COMPLETED", "PAID"].includes(normalizeStage(d.stage)) &&
        (d.stageUpdatedAt ?? d.createdAt) >= monthStart
    ).length;

    const metrics = {
      activeDeals: activeDealsRaw.length,
      pipelineValue,
      inProduction,
      completedThisMonth,
    };

    // ── Per-stage counts (display pipeline order) ──
    const stageCounts: { stage: DealStageValue; count: number; value: number }[] = PIPELINE_STAGES.map(
      (stage) => {
        const inStage = activeDealsRaw.filter((d) => normalizeStage(d.stage) === stage);
        return {
          stage,
          count: inStage.length,
          value: inStage.reduce((sum, d) => sum + (d.value ?? 0), 0),
        };
      }
    );

    // ── Universal campaign calendar ──
    type CalEvent = {
      date: string;
      type: "shoot" | "live" | "brief" | "payment";
      dealId: string;
      dealTitle: string;
      label: string;
    };
    const calendar: CalEvent[] = [];
    for (const c of activeDealsRaw) {
      // Shoot dates (red) — from the linked production.
      for (const sd of c.production?.shootDates ?? []) {
        calendar.push({
          date: new Date(sd).toISOString(),
          type: "shoot",
          dealId: c.id,
          dealTitle: c.title,
          label: `Shoot · ${c.title}`,
        });
      }
      // Content live dates (green) — deliverable due dates.
      for (const d of c.deliverables) {
        if (!d.dueDate) continue;
        calendar.push({
          date: new Date(d.dueDate).toISOString(),
          type: "live",
          dealId: c.id,
          dealTitle: c.title,
          label: `${d.title || d.type} · ${c.title}`,
        });
      }
      // Brief deadline (amber).
      if (c.briefDueDate) {
        calendar.push({
          date: new Date(c.briefDueDate).toISOString(),
          type: "brief",
          dealId: c.id,
          dealTitle: c.title,
          label: `Brief due · ${c.title}`,
        });
      }
      // Payment / deal due date (blue).
      if (c.dueDate) {
        calendar.push({
          date: new Date(c.dueDate).toISOString(),
          type: "payment",
          dealId: c.id,
          dealTitle: c.title,
          label: `Due · ${c.title}`,
        });
      }
    }

    // ── Recent activity (cross-portal) ──
    const activities = await prisma.dealActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            stage: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    });
    const recentActivity = activities
      .filter((a) => a.campaign)
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        type: a.type,
        message: a.message,
        userName: a.userName,
        createdAt: a.createdAt,
        campaign: {
          id: a.campaign!.id,
          title: a.campaign!.title,
          stage: normalizeStage(a.campaign!.stage),
          client: a.campaign!.client,
        },
      }));

    return NextResponse.json({ metrics, activeDeals, stageCounts, calendar, recentActivity });
  } catch (err) {
    console.error("GET /api/commercial/dashboard", err);
    return NextResponse.json({ error: "Failed to fetch dashboard" }, { status: 500 });
  }
});
