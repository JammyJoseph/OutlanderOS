import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import {
  parseAllocations,
  parseClientBrief,
  productionAllocationOf,
  mapSplitsToCampaignBudget,
} from "@/lib/deal-stages";

// POST /api/commercial/deals/[id]/sync-production
//
// Pushes Commercial-side changes made after "Clear for Production" to the
// linked Production record and the Finance CampaignBudget: brief content,
// production budget allocation, margin target, and finance splits. Stamps
// lastSyncedToProduction so the deal page knows everything is in sync.
export const POST = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    const { id } = await params;

    const deal = await prisma.campaign.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        production: { select: { id: true, productionBudgetStatus: true } },
      },
    });
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    if (!deal.production) {
      return NextResponse.json(
        { error: "This deal hasn't been cleared for production yet" },
        { status: 400 }
      );
    }

    const allocations = parseAllocations(deal.allocations);
    const productionAllocation = productionAllocationOf(allocations);
    const clientBrief = parseClientBrief(deal.clientBrief);
    const briefText =
      clientBrief?.content?.trim() || deal.briefContent?.trim() || deal.description || null;

    await prisma.production.update({
      where: { id: deal.production.id },
      data: {
        title: deal.title,
        clientName: deal.client.name,
        brief: briefText,
        marginTarget: deal.marginPercent ?? null,
        // Don't clobber a production budget the team has already locked/finalised.
        ...(allocations.length &&
        !["LOCKED", "FINAL"].includes(deal.production.productionBudgetStatus ?? "")
          ? { budgetTotal: productionAllocation }
          : {}),
      },
    });

    const financeBudget = await prisma.campaignBudget.findFirst({ where: { campaignId: id } });
    if (financeBudget && allocations.length) {
      const mapped = mapSplitsToCampaignBudget(
        allocations
          .filter((a) => !a.isProductionBudget)
          .map((a) => ({ category: a.name, amount: a.amount }))
      );
      await prisma.campaignBudget.update({
        where: { id: financeBudget.id },
        data: {
          clientName: deal.client.name,
          campaignName: deal.title,
          totalBudget: deal.value ?? financeBudget.totalBudget,
          productionBudget: productionAllocation + mapped.productionBudget,
          mediaBudget: mapped.mediaBudget,
          internalBudget: mapped.internalBudget,
          otherBudget: mapped.otherBudget,
        },
      });
    }

    const synced = await prisma.campaign.update({
      where: { id },
      data: { lastSyncedToProduction: new Date() },
      select: { lastSyncedToProduction: true },
    });

    await prisma.dealActivity.create({
      data: {
        campaignId: id,
        type: "project_started",
        message: `Changes on "${deal.title}" pushed to production — brief and budget re-synced${productionAllocation > 0 ? ` (production allocation £${productionAllocation.toLocaleString()})` : ""}`,
        meta: { productionId: deal.production.id, productionAllocation },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({
      success: true,
      lastSyncedToProduction: synced.lastSyncedToProduction,
    });
  } catch (err) {
    console.error("POST /api/commercial/deals/[id]/sync-production", err);
    return NextResponse.json({ error: "Failed to sync to production" }, { status: 500 });
  }
});
