import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, isAdminInDb } from "@/lib/auth";
import {
  parseAllocations,
  productionAllocationOf,
  mapSplitsToCampaignBudget,
  PIPELINE_STAGES,
  normalizeStage,
} from "@/lib/deal-stages";
import { parseMediaPlan, mediaPlanTotals } from "@/lib/media-plan";

// POST /api/commercial/deals/[id]/media-plan/lock — lock or unlock the plan.
// Body: { locked: boolean }. Anyone can lock; only an admin can unlock.
// Locking validates margin + allocations equal the plan total, advances the
// deal to BUDGET_SET, and pushes the finalised numbers into Finance.
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const locked = Boolean(body.locked);

    const deal = await prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        value: true,
        mediaPlan: true,
        marginAmount: true,
        marginPercent: true,
        allocations: true,
        stage: true,
      },
    });
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!locked) {
      if (!(await isAdminInDb(user))) {
        return NextResponse.json(
          { error: "Only an admin can unlock a locked media plan." },
          { status: 403 }
        );
      }
      await prisma.campaign.update({
        where: { id },
        data: {
          budgetLocked: false,
          budgetLockedAt: null,
          budgetLockedBy: null,
          mediaPlanLockedAt: null,
        },
      });
      await prisma.dealActivity.create({
        data: {
          campaignId: id,
          type: "budget_update",
          message: `Media plan on "${deal.title}" unlocked for editing`,
          userId: user.userId,
          userName: user.name,
        },
      });
      return NextResponse.json({ campaignId: id, locked: false });
    }

    // Locking: balance check against the plan's net total.
    const plan = parseMediaPlan(deal.mediaPlan);
    const total = mediaPlanTotals(plan).net;
    const allocations = parseAllocations(deal.allocations);
    const allocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    const margin = deal.marginAmount ?? 0;

    if (total <= 0) {
      return NextResponse.json(
        { error: "Add placements to the media plan before locking — the total is £0." },
        { status: 400 }
      );
    }
    if (Math.abs(allocated + margin - total) > 0.01) {
      return NextResponse.json(
        {
          error: `Allocations (£${allocated.toLocaleString()}) + margin (£${margin.toLocaleString()}) must equal the media plan total (£${total.toLocaleString()}) before locking.`,
        },
        { status: 400 }
      );
    }

    // Locking advances the deal to BUDGET_SET if it isn't already there or beyond.
    const stageIdx = PIPELINE_STAGES.indexOf(normalizeStage(deal.stage));
    const budgetSetIdx = PIPELINE_STAGES.indexOf("BUDGET_SET");
    const advanceStage = stageIdx < budgetSetIdx;

    await prisma.campaign.update({
      where: { id },
      data: {
        value: total,
        budgetLocked: true,
        budgetLockedAt: new Date(),
        budgetLockedBy: user.userId,
        mediaPlanLockedAt: new Date(),
        ...(advanceStage ? { stage: "BUDGET_SET", stageUpdatedAt: new Date() } : {}),
      },
    });

    if (advanceStage) {
      await prisma.dealActivity.create({
        data: {
          campaignId: id,
          type: "stage_change",
          message: `"${deal.title}" moved to BUDGET_SET (media plan locked)`,
          meta: { from: deal.stage, to: "BUDGET_SET" },
          userId: user.userId,
          userName: user.name,
        },
      });
    }

    // Push the finalised numbers into the Finance project folder if one exists.
    const financeBudget = await prisma.campaignBudget.findFirst({ where: { campaignId: id } });
    if (financeBudget) {
      const productionAllocation = productionAllocationOf(allocations);
      const mapped = mapSplitsToCampaignBudget(
        allocations.filter((a) => !a.isProductionBudget).map((a) => ({ category: a.name, amount: a.amount }))
      );
      await prisma.campaignBudget.update({
        where: { id: financeBudget.id },
        data: {
          totalBudget: total,
          productionBudget: productionAllocation + mapped.productionBudget,
          mediaBudget: mapped.mediaBudget,
          internalBudget: mapped.internalBudget,
          otherBudget: mapped.otherBudget,
        },
      });
    }

    const productionAllocation = productionAllocationOf(allocations);
    await prisma.dealActivity.create({
      data: {
        campaignId: id,
        type: "budget_update",
        message: `Media plan on "${deal.title}" locked — margin £${margin.toLocaleString()}${deal.marginPercent != null ? ` (${deal.marginPercent}%)` : ""} | production £${productionAllocation.toLocaleString()} | total £${total.toLocaleString()}`,
        meta: { marginAmount: margin, marginPercent: deal.marginPercent, allocations, total },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({ campaignId: id, locked: true, total });
  } catch (err) {
    console.error("POST /api/commercial/deals/[id]/media-plan/lock", err);
    return NextResponse.json({ error: "Failed to update media plan lock" }, { status: 500 });
  }
});
