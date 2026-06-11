import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { parseBudgetBreakdown, parseAllocations, productionAllocationOf } from "@/lib/deal-stages";

// GET /api/commercial/deals/[id]/budget — the deal's economics: total budget,
// company margin, allocations, and lock state.
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
        budgetBreakdown: true,
        marginPercent: true,
        marginAmount: true,
        allocations: true,
        budgetLocked: true,
        budgetLockedAt: true,
        budgetLockedBy: true,
      },
    });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const splits = parseBudgetBreakdown(campaign.budgetBreakdown);
    const allocations = parseAllocations(campaign.allocations);
    const total = splits.reduce((sum, s) => sum + s.amount, 0);

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
      value: campaign.value,
      currency: campaign.currency,
      splits,
      total,
      marginPercent: campaign.marginPercent,
      marginAmount: campaign.marginAmount,
      allocations,
      productionAllocation: productionAllocationOf(allocations),
      budgetLocked: campaign.budgetLocked,
      budgetLockedAt: campaign.budgetLockedAt,
      budgetLockedBy: campaign.budgetLockedBy,
      lockedByName,
    });
  } catch (err) {
    console.error("GET /api/commercial/deals/[id]/budget", err);
    return NextResponse.json({ error: "Failed to fetch budget" }, { status: 500 });
  }
});

// PUT /api/commercial/deals/[id]/budget — set the deal's margin + allocations.
// Rejected once the budget is locked (an admin must unlock first).
// budgetBreakdown is kept in sync with the allocations so legacy consumers
// (Clear for Production, Start Project) keep working.
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
      select: { id: true, title: true, value: true, budgetLocked: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.budgetLocked) {
      return NextResponse.json(
        { error: "This budget is locked. An admin must unlock it before it can be edited." },
        { status: 403 }
      );
    }

    // Legacy splits-only payloads still work.
    if (body.splits !== undefined && body.allocations === undefined) {
      const splits = parseBudgetBreakdown(body.splits);
      const total = splits.reduce((sum, s) => sum + s.amount, 0);
      await prisma.campaign.update({ where: { id }, data: { budgetBreakdown: splits } });
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
    }

    const allocations = parseAllocations(body.allocations);
    const marginAmount =
      body.marginAmount === null || body.marginAmount === undefined || body.marginAmount === ""
        ? null
        : Number(body.marginAmount);
    const marginPercent =
      body.marginPercent === null || body.marginPercent === undefined || body.marginPercent === ""
        ? null
        : Number(body.marginPercent);
    const totalBudget =
      body.totalBudget === null || body.totalBudget === undefined || body.totalBudget === ""
        ? existing.value
        : Number(body.totalBudget);

    const allocated = allocations.reduce((sum, a) => sum + a.amount, 0);

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(body.totalBudget !== undefined ? { value: totalBudget } : {}),
        marginPercent,
        marginAmount,
        allocations,
        // Mirror allocations into the legacy splits shape.
        budgetBreakdown: allocations.map((a) => ({ category: a.name, amount: a.amount })),
      },
      select: {
        id: true,
        value: true,
        marginPercent: true,
        marginAmount: true,
        allocations: true,
        budgetLocked: true,
      },
    });

    await prisma.dealActivity.create({
      data: {
        campaignId: id,
        type: "budget_update",
        message: `Budget on "${existing.title}" updated — margin £${(marginAmount ?? 0).toLocaleString()}${marginPercent != null ? ` (${marginPercent}%)` : ""}, £${allocated.toLocaleString()} allocated across ${allocations.length} line${allocations.length === 1 ? "" : "s"}`,
        meta: { marginAmount, marginPercent, allocations, totalBudget },
        userId: user.userId,
        userName: user.name,
      },
    });

    return NextResponse.json({
      campaignId: id,
      value: campaign.value,
      marginPercent: campaign.marginPercent,
      marginAmount: campaign.marginAmount,
      allocations: parseAllocations(campaign.allocations),
      budgetLocked: campaign.budgetLocked,
    });
  } catch (err) {
    console.error("PUT /api/commercial/deals/[id]/budget", err);
    return NextResponse.json({ error: "Failed to update budget" }, { status: 500 });
  }
});
