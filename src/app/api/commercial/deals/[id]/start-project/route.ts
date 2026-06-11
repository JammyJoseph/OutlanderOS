import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import {
  parseBudgetBreakdown,
  mapSplitsToCampaignBudget,
  mapSplitToProductionCategory,
} from "@/lib/deal-stages";

// POST /api/commercial/deals/[id]/start-project
// Body: { requiresProduction: boolean }
//
// Kicks a contracted deal downstream:
// - if production is needed, creates a Production (type COMMERCIAL) with the
//   deal's budget locked in, plus budget line items from the deal's splits
// - always creates a CampaignBudget in Finance with the splits mapped onto
//   the fixed Finance columns
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requiresProduction = Boolean(body.requiresProduction);

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
        { error: "A production has already been started for this deal" },
        { status: 400 }
      );
    }

    const existingBudget = await prisma.campaignBudget.findFirst({
      where: { campaignId: id },
      select: { id: true },
    });
    if (existingBudget) {
      return NextResponse.json(
        { error: "A finance budget already exists for this deal" },
        { status: 400 }
      );
    }

    const splits = parseBudgetBreakdown(deal.budgetBreakdown);
    const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
    // The deal value is the total budget (margin included); splits are the
    // spend after margin — matches what the budget lock pushes to Finance.
    const totalBudget = deal.value ?? (splitTotal > 0 ? splitTotal : 0);
    const mapped = mapSplitsToCampaignBudget(splits);

    let production = null;
    if (requiresProduction) {
      production = await prisma.production.create({
        data: {
          campaignId: deal.id,
          title: deal.title,
          clientName: deal.client.name,
          brief: deal.description,
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
    }

    const campaignBudget = await prisma.campaignBudget.create({
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
        productionId: production?.id ?? null,
        notes: `Created from Commercial deal "${deal.title}"`,
      },
    });

    if (production) {
      await prisma.production.update({
        where: { id: production.id },
        data: { campaignBudgetId: campaignBudget.id },
      });
    }

    await prisma.dealActivity.create({
      data: {
        campaignId: deal.id,
        type: "project_started",
        message: requiresProduction
          ? `Project started for "${deal.title}" — production created with £${totalBudget.toLocaleString()} budget`
          : `Project started for "${deal.title}" — finance budget created (no production needed)`,
        meta: { productionId: production?.id ?? null, campaignBudgetId: campaignBudget.id, totalBudget },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({
      production,
      campaignBudget,
    });
  } catch (err) {
    console.error("POST /api/commercial/deals/[id]/start-project", err);
    return NextResponse.json({ error: "Failed to start project" }, { status: 500 });
  }
});
