import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { parseAllocations, productionAllocationOf, mapSplitsToCampaignBudget } from "@/lib/deal-stages";
import { parseMediaPlan, mediaPlanTotals, mediaPlanLineCount } from "@/lib/media-plan";

// GET /api/commercial/deals/[id]/media-plan
// Returns the full media plan plus the deal economics (margin + allocations)
// and lock state — everything the Media Plan tab needs in one fetch.
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        value: true,
        currency: true,
        mediaPlan: true,
        mediaPlanVersion: true,
        mediaPlanUpdatedAt: true,
        mediaPlanUpdatedBy: true,
        mediaPlanLockedAt: true,
        marginPercent: true,
        marginAmount: true,
        allocations: true,
        budgetLocked: true,
        budgetLockedBy: true,
      },
    });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const plan = parseMediaPlan(campaign.mediaPlan);
    const totals = mediaPlanTotals(plan);
    const allocations = parseAllocations(campaign.allocations);

    let lockedByName: string | null = null;
    if (campaign.budgetLockedBy) {
      const lockedBy = await prisma.user.findUnique({
        where: { id: campaign.budgetLockedBy },
        select: { name: true },
      });
      lockedByName = lockedBy?.name ?? null;
    }

    return NextResponse.json({
      campaignId: campaign.id,
      currency: campaign.currency,
      plan,
      totals,
      version: campaign.mediaPlanVersion,
      updatedAt: campaign.mediaPlanUpdatedAt,
      updatedBy: campaign.mediaPlanUpdatedBy,
      lockedAt: campaign.mediaPlanLockedAt,
      locked: Boolean(campaign.mediaPlanLockedAt) || campaign.budgetLocked,
      lockedByName,
      value: campaign.value,
      marginPercent: campaign.marginPercent,
      marginAmount: campaign.marginAmount,
      allocations,
      productionAllocation: productionAllocationOf(allocations),
    });
  } catch (err) {
    console.error("GET /api/commercial/deals/[id]/media-plan", err);
    return NextResponse.json({ error: "Failed to fetch media plan" }, { status: 500 });
  }
});

// PUT /api/commercial/deals/[id]/media-plan
// Saves the plan + economics. The plan's net total becomes the deal value.
// Allowed whether locked or not: saving a locked plan is the "Update & Re-lock"
// action — the lock state is preserved, the version bumps, and Finance is
// re-synced. When locked, margin + allocations must still equal the new total.
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        mediaPlanVersion: true,
        mediaPlanLockedAt: true,
        budgetLocked: true,
      },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const locked = Boolean(existing.mediaPlanLockedAt) || existing.budgetLocked;

    const plan = parseMediaPlan(body.plan);
    const totals = mediaPlanTotals(plan);
    const total = totals.net;

    const allocations = parseAllocations(body.allocations);
    const allocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    const marginAmount =
      body.marginAmount === null || body.marginAmount === undefined || body.marginAmount === ""
        ? null
        : Number(body.marginAmount);
    const marginPercent =
      body.marginPercent === null || body.marginPercent === undefined || body.marginPercent === ""
        ? null
        : Number(body.marginPercent);

    // A locked plan must stay balanced when re-saved.
    if (locked) {
      if (total <= 0) {
        return NextResponse.json({ error: "The media plan can't total £0 while locked." }, { status: 400 });
      }
      if (Math.abs(allocated + (marginAmount ?? 0) - total) > 0.01) {
        return NextResponse.json(
          {
            error: `Allocations (£${allocated.toLocaleString()}) + margin (£${(marginAmount ?? 0).toLocaleString()}) must equal the media plan total (£${total.toLocaleString()}) to re-lock.`,
          },
          { status: 400 }
        );
      }
    }

    const version = existing.mediaPlanVersion + 1;
    const stampedPlan = {
      ...plan,
      version,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
    };

    await prisma.campaign.update({
      where: { id },
      data: {
        mediaPlan: stampedPlan as unknown as Prisma.InputJsonValue,
        mediaPlanVersion: version,
        mediaPlanUpdatedAt: new Date(),
        mediaPlanUpdatedBy: user.name,
        // The net total IS the deal budget.
        value: total,
        marginPercent,
        marginAmount,
        allocations,
        budgetBreakdown: allocations.map((a) => ({ category: a.name, amount: a.amount })),
      },
    });

    // If the plan is locked, keep Finance in step with the re-saved numbers.
    if (locked) {
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
    }

    await prisma.dealActivity.create({
      data: {
        campaignId: id,
        type: "budget_update",
        message: `Media plan on "${existing.title}" ${locked ? "updated & re-locked" : "saved"} — v${version}, ${mediaPlanLineCount(plan)} line${mediaPlanLineCount(plan) === 1 ? "" : "s"}, £${total.toLocaleString()} total`,
        meta: { version, total, gross: totals.gross, discount: totals.discount, locked },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({
      campaignId: id,
      plan: stampedPlan,
      totals,
      version,
      value: total,
      locked,
    });
  } catch (err) {
    console.error("PUT /api/commercial/deals/[id]/media-plan", err);
    return NextResponse.json({ error: "Failed to save media plan" }, { status: 500 });
  }
});
