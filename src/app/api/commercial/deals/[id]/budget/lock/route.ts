import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, isAdminInDb } from "@/lib/auth";
import {
  parseAllocations,
  productionAllocationOf,
  mapSplitsToCampaignBudget,
} from "@/lib/deal-stages";

// POST /api/commercial/deals/[id]/budget/lock — lock or unlock the deal budget.
// Body: { locked: boolean }. Anyone can lock; only an admin can unlock.
// Locking validates that margin + allocations equal the total budget and
// pushes the finalised numbers into the linked Finance CampaignBudget.
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
        marginAmount: true,
        marginPercent: true,
        allocations: true,
        budgetLocked: true,
        stage: true,
      },
    });
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!locked) {
      // Check the role fresh from the DB — the JWT bakes the role in at login,
      // so admins promoted after signing in would otherwise be rejected.
      if (!(await isAdminInDb(user))) {
        return NextResponse.json(
          { error: "Only an admin can unlock a finalised budget." },
          { status: 403 }
        );
      }
      const campaign = await prisma.campaign.update({
        where: { id },
        data: { budgetLocked: false, budgetLockedAt: null, budgetLockedBy: null },
        select: { id: true, budgetLocked: true },
      });
      await prisma.dealActivity.create({
        data: {
          campaignId: id,
          type: "budget_update",
          message: `Budget on "${deal.title}" unlocked for editing`,
          userId: user.userId,
          userName: user.name,
        },
      });
      return NextResponse.json({ campaignId: id, budgetLocked: campaign.budgetLocked });
    }

    // Locking: the allocations + margin must add up to the total budget.
    const allocations = parseAllocations(deal.allocations);
    const allocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    const margin = deal.marginAmount ?? 0;
    const total = deal.value ?? 0;
    if (total <= 0) {
      return NextResponse.json(
        { error: "Set the total deal budget before locking." },
        { status: 400 }
      );
    }
    if (Math.abs(allocated + margin - total) > 0.01) {
      return NextResponse.json(
        {
          error: `Allocations (£${allocated.toLocaleString()}) + margin (£${margin.toLocaleString()}) must equal the total budget (£${total.toLocaleString()}) before locking.`,
        },
        { status: 400 }
      );
    }

    // Locking from Contracted advances the pipeline to Budget Set.
    const advanceStage = deal.stage === "CONTRACTED";
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        budgetLocked: true,
        budgetLockedAt: new Date(),
        budgetLockedBy: user.userId,
        ...(advanceStage ? { stage: "BUDGET_SET", stageUpdatedAt: new Date() } : {}),
      },
      select: { id: true, budgetLocked: true, budgetLockedAt: true, stage: true },
    });
    if (advanceStage) {
      await prisma.dealActivity.create({
        data: {
          campaignId: id,
          type: "stage_change",
          message: `"${deal.title}" moved from CONTRACTED to BUDGET_SET (budget locked)`,
          meta: { from: "CONTRACTED", to: "BUDGET_SET" },
          userId: user.userId,
          userName: user.name,
        },
      });
    }

    // Push the finalised splits into the Finance project folder if one exists.
    const financeBudget = await prisma.campaignBudget.findFirst({ where: { campaignId: id } });
    if (financeBudget) {
      const productionAllocation = productionAllocationOf(allocations);
      const mapped = mapSplitsToCampaignBudget(
        allocations
          .filter((a) => !a.isProductionBudget)
          .map((a) => ({ category: a.name, amount: a.amount }))
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
        message: `Budget on "${deal.title}" locked — margin £${margin.toLocaleString()}${deal.marginPercent != null ? ` (${deal.marginPercent}%)` : ""} | production £${productionAllocation.toLocaleString()} | total £${total.toLocaleString()}`,
        meta: { marginAmount: margin, marginPercent: deal.marginPercent, allocations, total },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({
      campaignId: id,
      budgetLocked: campaign.budgetLocked,
      budgetLockedAt: campaign.budgetLockedAt,
    });
  } catch (err) {
    console.error("POST /api/commercial/deals/[id]/budget/lock", err);
    return NextResponse.json({ error: "Failed to update budget lock" }, { status: 500 });
  }
});
