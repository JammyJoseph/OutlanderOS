import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { productionAllocationOf } from "@/lib/deal-stages";
import {
  computeEconomics,
  economicsToAllocations,
  marginPercentOfDeal,
  DEFAULT_PRODUCTION_MARGIN_PCT,
} from "@/lib/deal-economics";

// GET /api/commercial/deals/[id]/media-plan
// Returns the simplified media plan (Sheets link / PDF / deal value) plus the
// derived deal economics and lock state — everything the Media Plan tab needs.
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
        currency: true,
        mediaPlanLink: true,
        mediaPlanFile: true,
        dealValue: true,
        mediaSpend: true,
        productionMarginPct: true,
        value: true,
        mediaPlanVersion: true,
        mediaPlanUpdatedAt: true,
        mediaPlanUpdatedBy: true,
        mediaPlanLockedAt: true,
        budgetLocked: true,
        budgetLockedBy: true,
      },
    });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Fall back to the legacy deal value if dealValue hasn't been set yet.
    const dealValue = campaign.dealValue ?? campaign.value ?? 0;
    const eco = computeEconomics({
      dealValue,
      mediaSpend: campaign.mediaSpend,
      productionMarginPct: campaign.productionMarginPct ?? DEFAULT_PRODUCTION_MARGIN_PCT,
    });

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
      mediaPlanLink: campaign.mediaPlanLink,
      mediaPlanFile: campaign.mediaPlanFile,
      economics: eco,
      version: campaign.mediaPlanVersion,
      updatedAt: campaign.mediaPlanUpdatedAt,
      updatedBy: campaign.mediaPlanUpdatedBy,
      lockedAt: campaign.mediaPlanLockedAt,
      locked: Boolean(campaign.mediaPlanLockedAt) || campaign.budgetLocked,
      lockedByName,
    });
  } catch (err) {
    console.error("GET /api/commercial/deals/[id]/media-plan", err);
    return NextResponse.json({ error: "Failed to fetch media plan" }, { status: 500 });
  }
});

// PUT /api/commercial/deals/[id]/media-plan
// Saves the Sheets link / PDF path / deal value + the media-vs-production split.
// The deal value becomes the deal value (Campaign.value) and the derived
// allocations + company margin are written so the existing clear-for-production
// and Finance pipelines stay coherent. Allowed locked or unlocked (the locked
// save is the "Update & Re-lock" flow); the lock state is preserved.
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

    const eco = computeEconomics({
      dealValue: body.dealValue,
      mediaSpend: body.mediaSpend,
      productionMarginPct: body.productionMarginPct,
    });

    if (locked && eco.dealValue <= 0) {
      return NextResponse.json(
        { error: "The deal value can't be £0 while the media plan is locked." },
        { status: 400 }
      );
    }

    const mediaPlanLink =
      body.mediaPlanLink === undefined
        ? undefined
        : body.mediaPlanLink
          ? String(body.mediaPlanLink).trim()
          : null;
    const mediaPlanFile =
      body.mediaPlanFile === undefined
        ? undefined
        : body.mediaPlanFile
          ? String(body.mediaPlanFile).trim()
          : null;

    const allocations = economicsToAllocations(eco);
    const version = existing.mediaPlanVersion + 1;

    await prisma.campaign.update({
      where: { id },
      data: {
        ...(mediaPlanLink !== undefined ? { mediaPlanLink } : {}),
        ...(mediaPlanFile !== undefined ? { mediaPlanFile } : {}),
        dealValue: eco.dealValue,
        mediaSpend: eco.mediaSpend,
        productionMarginPct: eco.productionMarginPct,
        // The deal value IS the deal budget; downstream reads Campaign.value.
        value: eco.dealValue,
        marginAmount: eco.companyMargin,
        marginPercent: marginPercentOfDeal(eco),
        allocations,
        budgetBreakdown: allocations.map((a) => ({ category: a.name, amount: a.amount })),
        mediaPlanVersion: version,
        mediaPlanUpdatedAt: new Date(),
        mediaPlanUpdatedBy: user.name,
      },
    });

    // Keep Finance in step when the plan is locked.
    if (locked) {
      const financeBudget = await prisma.campaignBudget.findFirst({ where: { campaignId: id } });
      if (financeBudget) {
        await prisma.campaignBudget.update({
          where: { id: financeBudget.id },
          data: {
            totalBudget: eco.dealValue,
            productionBudget: eco.hardCostBudget,
            mediaBudget: eco.mediaSpend,
            internalBudget: 0,
            otherBudget: 0,
          },
        });
      }
    }

    await prisma.dealActivity.create({
      data: {
        campaignId: id,
        type: "budget_update",
        message: `Media plan on "${existing.title}" ${locked ? "updated & re-locked" : "saved"} — deal value £${eco.dealValue.toLocaleString()}, media £${eco.mediaSpend.toLocaleString()}, production £${eco.productionBudget.toLocaleString()}`,
        meta: {
          version,
          dealValue: eco.dealValue,
          mediaSpend: eco.mediaSpend,
          productionBudget: eco.productionBudget,
          companyMargin: eco.companyMargin,
          hardCostBudget: eco.hardCostBudget,
          locked,
        },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({
      campaignId: id,
      economics: eco,
      version,
      locked,
      productionAllocation: productionAllocationOf(allocations),
    });
  } catch (err) {
    console.error("PUT /api/commercial/deals/[id]/media-plan", err);
    return NextResponse.json({ error: "Failed to save media plan" }, { status: 500 });
  }
});
