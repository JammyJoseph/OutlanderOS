import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { PIPELINE_STAGES, ACTIVE_STAGES, WON_STAGES, normalizeStage } from "@/lib/deal-stages";

// GET /api/commercial/stats — pipeline value, deals this month, won this quarter,
// revenue booked, per-stage breakdown, and the current hot deal.
export const GET = withAuth(async () => {
  try {
    const deals = await prisma.campaign.findMany({
      where: { archived: false, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        title: true,
        stage: true,
        stageUpdatedAt: true,
        value: true,
        type: true,
        dueDate: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

    const totalPipelineValue = deals
      .filter((d) => (ACTIVE_STAGES as string[]).includes(d.stage))
      .reduce((sum, d) => sum + (d.value ?? 0), 0);

    const dealsThisMonth = deals.filter((d) => d.createdAt >= monthStart).length;

    const wonThisQuarter = deals.filter(
      (d) =>
        (WON_STAGES as string[]).includes(d.stage) &&
        (d.stageUpdatedAt ?? d.createdAt) >= quarterStart
    ).length;

    const revenueBooked = deals
      .filter((d) => (WON_STAGES as string[]).includes(d.stage))
      .reduce((sum, d) => sum + (d.value ?? 0), 0);

    // Per-stage breakdown over the display pipeline; legacy NEGOTIATING deals
    // fold into PITCHED so they stay visible.
    const stages = PIPELINE_STAGES.map((stage) => {
      const inStage = deals.filter((d) => normalizeStage(d.stage) === stage);
      return {
        stage,
        count: inStage.length,
        value: inStage.reduce((sum, d) => sum + (d.value ?? 0), 0),
      };
    });

    // Hot deal — active deal with the closest due date; falls back to the
    // highest-value deal in negotiation.
    const active = deals.filter((d) => (ACTIVE_STAGES as string[]).includes(d.stage));
    const withDeadline = active
      .filter((d) => d.dueDate && d.dueDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30))
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
    let hotDeal = withDeadline[0] ?? null;
    if (!hotDeal) {
      const inMotion = active
        .filter((d) =>
          ["DEAL_SIGNED", "CREATIVE_REVIEW", "CREATIVE_APPROVED", "APPROVAL", "IO_SIGNED"].includes(
            normalizeStage(d.stage)
          )
        )
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      hotDeal = inMotion[0] ?? null;
    }
    if (!hotDeal) {
      const byValue = [...active].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      hotDeal = byValue[0] ?? null;
    }

    return NextResponse.json({
      totalPipelineValue,
      dealsThisMonth,
      wonThisQuarter,
      revenueBooked,
      stages,
      hotDeal,
    });
  } catch (err) {
    console.error("GET /api/commercial/stats", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
});
