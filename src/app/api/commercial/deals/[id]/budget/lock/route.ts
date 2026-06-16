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

    // The budget can only be locked once the deal is signed off.
    if (PIPELINE_STAGES.indexOf(normalizeStage(deal.stage)) < PIPELINE_STAGES.indexOf("DEAL_SIGNED")) {
      return NextResponse.json(
        { error: "Sign the deal off (move it to Deal Signed) before locking the budget." },
        { status: 400 }
      );
    }

    // Locking just freezes the numbers — stage progression is handled
    // explicitly on the pipeline / deal page (deal sign-off is separate from
    // creative and commercial sign-off).
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        budgetLocked: true,
        budgetLockedAt: new Date(),
        budgetLockedBy: user.userId,
      },
      select: { id: true, budgetLocked: true, budgetLockedAt: true, stage: true },
    });

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
