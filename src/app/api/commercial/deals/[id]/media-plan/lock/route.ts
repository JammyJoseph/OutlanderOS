import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, isAdminInDb } from "@/lib/auth";
import { PIPELINE_STAGES, normalizeStage } from "@/lib/deal-stages";
import { computeEconomics, DEFAULT_PRODUCTION_MARGIN_PCT } from "@/lib/deal-economics";

// POST /api/commercial/deals/[id]/media-plan/lock — lock or unlock the plan.
// Body: { locked: boolean }. Anyone can lock; only an admin can unlock.
// Locking finalises the deal value + media/production split for the Production
// team and Finance, and pushes the numbers into the linked Finance project.
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
        dealValue: true,
        mediaSpend: true,
        productionMarginPct: true,
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

    // Locking: the deal value must be set.
    const eco = computeEconomics({
      dealValue: deal.dealValue ?? deal.value,
      mediaSpend: deal.mediaSpend,
      productionMarginPct: deal.productionMarginPct ?? DEFAULT_PRODUCTION_MARGIN_PCT,
    });

    if (eco.dealValue <= 0) {
      return NextResponse.json(
        { error: "Set the deal value before locking the media plan — it's £0." },
        { status: 400 }
      );
    }

    // The media plan can only be locked once the deal is signed off.
    if (PIPELINE_STAGES.indexOf(normalizeStage(deal.stage)) < PIPELINE_STAGES.indexOf("DEAL_SIGNED")) {
      return NextResponse.json(
        { error: "Sign the deal off (move it to Deal Signed) before locking the media plan." },
        { status: 400 }
      );
    }

    await prisma.campaign.update({
      where: { id },
      data: {
        value: eco.dealValue,
        dealValue: eco.dealValue,
        budgetLocked: true,
        budgetLockedAt: new Date(),
        budgetLockedBy: user.userId,
        mediaPlanLockedAt: new Date(),
      },
    });

    // Push the finalised numbers into the Finance project folder if one exists.
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

    await prisma.dealActivity.create({
      data: {
        campaignId: id,
        type: "budget_update",
        message: `Media plan on "${deal.title}" locked — deal £${eco.dealValue.toLocaleString()} | media £${eco.mediaSpend.toLocaleString()} | production margin £${eco.companyMargin.toLocaleString()} | hard costs £${eco.hardCostBudget.toLocaleString()}`,
        meta: {
          dealValue: eco.dealValue,
          mediaSpend: eco.mediaSpend,
          companyMargin: eco.companyMargin,
          hardCostBudget: eco.hardCostBudget,
        },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({ campaignId: id, locked: true, total: eco.dealValue });
  } catch (err) {
    console.error("POST /api/commercial/deals/[id]/media-plan/lock", err);
    return NextResponse.json({ error: "Failed to update media plan lock" }, { status: 500 });
  }
});
