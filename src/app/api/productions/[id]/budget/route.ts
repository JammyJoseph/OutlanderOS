import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// Production budget categories → Finance CostEntry categories.
const COST_CATEGORY: Record<string, string> = {
  production_company: "production",
  styling: "production",
  glam_mua: "production",
  talent: "talent",
  location: "location",
  catering: "catering",
  equipment: "equipment",
  travel: "travel",
  contingency: "other",
  internal: "internal",
  other: "other",
};

// Mirror a budget line's actual spend into Finance as a CostEntry (coded to
// the production's CampaignBudget) so costs logged in Production show up in
// Finance's project folders too. No-op for productions without a linked
// finance budget.
async function syncCostEntry(item: {
  id: string;
  productionId: string;
  category: string;
  description: string;
  actual: number;
}) {
  const production = await prisma.production.findUnique({
    where: { id: item.productionId },
    select: { campaignBudgetId: true, title: true },
  });
  if (!production?.campaignBudgetId) return;

  if (!item.actual || item.actual <= 0) {
    await prisma.costEntry.deleteMany({ where: { budgetLineItemId: item.id } });
    return;
  }

  const data = {
    campaignBudgetId: production.campaignBudgetId,
    category: COST_CATEGORY[item.category] ?? "other",
    description: item.description || `${item.category} (${production.title})`,
    amount: item.actual,
    portal: "production",
  };
  await prisma.costEntry.upsert({
    where: { budgetLineItemId: item.id },
    create: { ...data, budgetLineItemId: item.id },
    update: data,
  });
}

// Lifecycle guard: once the production budget is locked the budgeted amounts
// are frozen (actuals still flow in); once FINAL everything is read-only.
async function budgetGuard(
  productionId: string,
  change: { budgeted?: boolean; structure?: boolean; actual?: boolean }
): Promise<string | null> {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: { productionBudgetStatus: true },
  });
  const status = production?.productionBudgetStatus;
  if (!status || status === "BUDGETING") return null;
  if (status === "FINAL") {
    return "This production budget is FINAL — it can no longer be edited.";
  }
  // LOCKED / IN_PROGRESS: line items and budgeted amounts are frozen.
  if (change.structure || change.budgeted) {
    return "The budgeted amounts are locked — only actual costs can be updated. An admin can reopen the budget.";
  }
  return null;
}

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const items = await prisma.budgetLineItem.findMany({
      where: { productionId: id },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.json();
  try {
    const blocked = await budgetGuard(id, { structure: true });
    if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
    const item = await prisma.budgetLineItem.create({
      data: {
        productionId: id,
        category: body.category || "other",
        description: body.description || "",
        budgeted: body.budgeted == null || body.budgeted === "" ? 0 : Number(body.budgeted),
        actual: body.actual == null || body.actual === "" ? 0 : Number(body.actual),
        notes: body.notes || null,
        sortOrder: body.sortOrder == null ? 0 : Number(body.sortOrder),
      },
    });
    await syncCostEntry(item);
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  const body = await request.json();
  try {
    const existing = await prisma.budgetLineItem.findUnique({
      where: { id: itemId },
      select: { productionId: true, budgeted: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const changesBudgeted =
      body.budgeted !== undefined && Number(body.budgeted || 0) !== existing.budgeted;
    const blocked = await budgetGuard(existing.productionId, {
      budgeted: changesBudgeted,
      actual: body.actual !== undefined,
    });
    if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

    const data: Record<string, unknown> = {};
    if (body.category !== undefined) data.category = body.category;
    if (body.description !== undefined) data.description = body.description;
    if (body.budgeted !== undefined)
      data.budgeted = body.budgeted === "" || body.budgeted == null ? 0 : Number(body.budgeted);
    if (body.actual !== undefined)
      data.actual = body.actual === "" || body.actual == null ? 0 : Number(body.actual);
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);

    const item = await prisma.budgetLineItem.update({ where: { id: itemId }, data });
    await syncCostEntry(item);
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  try {
    const existing = await prisma.budgetLineItem.findUnique({
      where: { id: itemId },
      select: { productionId: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const blocked = await budgetGuard(existing.productionId, { structure: true });
    if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

    await prisma.costEntry.deleteMany({ where: { budgetLineItemId: itemId } });
    await prisma.budgetLineItem.delete({ where: { id: itemId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});
