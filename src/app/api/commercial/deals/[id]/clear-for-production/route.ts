import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import {
  parseBudgetBreakdown,
  mapSplitsToCampaignBudget,
  mapSplitToProductionCategory,
} from "@/lib/deal-stages";

// POST /api/commercial/deals/[id]/clear-for-production
//
// Clears a contracted deal for production in one step:
// - creates a Production (type COMMERCIAL, shown as "Planning") with the
//   deal's budget locked in and the creative brief copied across
// - creates a CampaignBudget in Finance with the deal's budget splits
//   (reuses an existing one if the budget was already submitted)
// - marks the deal's brief as SENT_TO_PRODUCTION and logs the activity
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
        production: { select: { id: true } },
      },
    });
    if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    if (deal.production) {
      return NextResponse.json(
        { error: "This deal has already been cleared for production" },
        { status: 400 }
      );
    }

    const splits = parseBudgetBreakdown(deal.budgetBreakdown);
    const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
    const totalBudget = splitTotal > 0 ? splitTotal : deal.value ?? 0;
    const mapped = mapSplitsToCampaignBudget(splits);

    // The brief travels with the production — description for the overview,
    // brief for the "Brief from Commercial" panel.
    const briefText = deal.briefContent?.trim() || deal.description || null;

    const production = await prisma.production.create({
      data: {
        campaignId: deal.id,
        title: deal.title,
        clientName: deal.client.name,
        brief: briefText,
        description: briefText,
        type: "COMMERCIAL",
        status: "DRAFT", // shown as "Planning" in the Production portal
        budgetTotal: totalBudget,
        budgetItems: splits.length
          ? {
              create: splits.map((s, i) => ({
                category: mapSplitToProductionCategory(s.category),
                description: `${s.category} — from Commercial deal budget`,
                budgeted: s.amount,
                sortOrder: i,
              })),
            }
          : undefined,
      },
    });

    // Reuse a finance budget if one was already created for this deal.
    let campaignBudget = await prisma.campaignBudget.findFirst({
      where: { campaignId: id },
    });
    if (campaignBudget) {
      campaignBudget = await prisma.campaignBudget.update({
        where: { id: campaignBudget.id },
        data: { productionId: production.id },
      });
    } else {
      campaignBudget = await prisma.campaignBudget.create({
        data: {
          campaignId: deal.id,
          clientName: deal.client.name,
          campaignName: deal.title,
          totalBudget,
          productionBudget: mapped.productionBudget,
          mediaBudget: mapped.mediaBudget,
          internalBudget: mapped.internalBudget,
          otherBudget: splits.length ? mapped.otherBudget : totalBudget,
          status: "SUBMITTED",
          submittedBy: user.userId,
          productionId: production.id,
          notes: `Created from Commercial deal "${deal.title}"`,
        },
      });
    }

    await prisma.production.update({
      where: { id: production.id },
      data: { campaignBudgetId: campaignBudget.id },
    });

    await prisma.campaign.update({
      where: { id: deal.id },
      data: { briefStatus: "SENT_TO_PRODUCTION" },
    });

    await prisma.dealActivity.create({
      data: {
        campaignId: deal.id,
        type: "project_started",
        message: `"${deal.title}" cleared for production — brief sent to the production team with £${totalBudget.toLocaleString()} budget`,
        meta: {
          productionId: production.id,
          campaignBudgetId: campaignBudget.id,
          totalBudget,
        },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({ production, campaignBudget });
  } catch (err) {
    console.error("POST /api/commercial/deals/[id]/clear-for-production", err);
    return NextResponse.json({ error: "Failed to clear for production" }, { status: 500 });
  }
});
