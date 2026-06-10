import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { parseBudgetBreakdown } from "@/lib/deal-stages";

// GET /api/commercial/deals/[id]/budget — the deal's budget breakdown
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, value: true, currency: true, budgetBreakdown: true },
    });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const splits = parseBudgetBreakdown(campaign.budgetBreakdown);
    const total = splits.reduce((sum, s) => sum + s.amount, 0);

    return NextResponse.json({
      campaignId: campaign.id,
      value: campaign.value,
      currency: campaign.currency,
      splits,
      total,
    });
  } catch (err) {
    console.error("GET /api/commercial/deals/[id]/budget", err);
    return NextResponse.json({ error: "Failed to fetch budget" }, { status: 500 });
  }
});

// PUT /api/commercial/deals/[id]/budget — set/update the deal's budget splits
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user
) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const splits = parseBudgetBreakdown(body.splits);
    const total = splits.reduce((sum, s) => sum + s.amount, 0);

    const existing = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.campaign.update({
      where: { id },
      data: { budgetBreakdown: splits },
    });

    await prisma.dealActivity.create({
      data: {
        campaignId: id,
        type: "budget_update",
        message: `Budget breakdown on "${existing.title}" updated — £${total.toLocaleString()} across ${splits.length} line${splits.length === 1 ? "" : "s"}`,
        meta: { splits, total },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({ campaignId: id, splits, total });
  } catch (err) {
    console.error("PUT /api/commercial/deals/[id]/budget", err);
    return NextResponse.json({ error: "Failed to update budget" }, { status: 500 });
  }
});
