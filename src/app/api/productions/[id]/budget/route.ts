import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// Production budget categories → Finance CostEntry categories. Covers both the
// new industry-standard section keys and the legacy free-form category keys so
// production actuals always land in a sensible Finance bucket.
const COST_CATEGORY: Record<string, string> = {
  // Industry-standard sections
  PRE_PRODUCTION: "production",
  CAST_TALENT: "talent",
  CREW: "production",
  STYLING_GLAM: "production",
  LOCATIONS: "location",
  EQUIPMENT: "equipment",
  TRANSPORT: "travel",
  CATERING: "catering",
  ART_DEPARTMENT: "production",
  POST_PRODUCTION: "production",
  // Legacy categories
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

// Legacy category → section, mirrors LEGACY_CATEGORY_TO_SECTION in the UI types.
const LEGACY_TO_SECTION: Record<string, string> = {
  production_company: "CREW",
  styling: "STYLING_GLAM",
  glam_mua: "STYLING_GLAM",
  talent: "CAST_TALENT",
  location: "LOCATIONS",
  catering: "CATERING",
  equipment: "EQUIPMENT",
  travel: "TRANSPORT",
  contingency: "PRE_PRODUCTION",
  internal: "PRE_PRODUCTION",
  other: "ART_DEPARTMENT",
};

// Default line items seeded when a budget is set up from the template. Mirrors
// BUDGET_SECTIONS in the UI types; kept here so the server can seed in one call.
const BUDGET_TEMPLATE: { section: string; roles: string[] }[] = [
  { section: "PRE_PRODUCTION", roles: ["Producer", "Production Manager", "Recce", "Insurance", "Contingency"] },
  { section: "CAST_TALENT", roles: ["Lead Talent", "Extras / Background"] },
  { section: "CREW", roles: ["DOP / Videographer", "Camera Assistant", "Sound Recordist", "BTS"] },
  { section: "STYLING_GLAM", roles: ["Wardrobe Stylist", "Hair Stylist", "MUA"] },
  { section: "LOCATIONS", roles: ["Location Fee", "Green Room / Base"] },
  { section: "EQUIPMENT", roles: ["Lighting Kit", "Camera Kit", "Grip Kit"] },
  { section: "TRANSPORT", roles: ["Production Van", "Taxi / Mileage"] },
  { section: "CATERING", roles: ["Crew Catering"] },
  { section: "ART_DEPARTMENT", roles: ["Props"] },
  { section: "POST_PRODUCTION", roles: ["Editor", "Colourist", "Retouching"] },
];

// Mirror a budget line's actual spend into Finance as a CostEntry (coded to
// the production's CampaignBudget) so costs logged in Production show up in
// Finance's project folders too. No-op for productions without a linked
// finance budget.
async function syncCostEntry(item: {
  id: string;
  productionId: string;
  category: string;
  section: string | null;
  role: string | null;
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

  // Prefer the section mapping; fall back to the legacy category.
  const financeCategory =
    COST_CATEGORY[item.section ?? ""] ?? COST_CATEGORY[item.category] ?? "other";
  const label = item.description || item.role || item.category;
  const data = {
    campaignBudgetId: production.campaignBudgetId,
    category: financeCategory,
    description: label ? `${label} (${production.title})` : production.title,
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
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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

    // Template action: seed the standard section structure with empty,
    // ready-to-fill line items. Skips sections that already have items so it's
    // safe to run on a partially-filled budget.
    if (body.template) {
      const existing = await prisma.budgetLineItem.findMany({
        where: { productionId: id },
        select: { section: true, category: true },
      });
      const filledSections = new Set(
        existing.map((e) => e.section ?? LEGACY_TO_SECTION[e.category] ?? "")
      );
      const rows: {
        productionId: string;
        category: string;
        section: string;
        role: string;
        quantity: number;
        vatPercent: number;
        description: string;
        budgeted: number;
        actual: number;
        sortOrder: number;
      }[] = [];
      let order = 0;
      for (const sec of BUDGET_TEMPLATE) {
        if (filledSections.has(sec.section)) continue;
        for (const role of sec.roles) {
          rows.push({
            productionId: id,
            category: sec.section,
            section: sec.section,
            role,
            quantity: 1, // template lines default to a quantity of 1
            vatPercent: 20,
            description: "",
            budgeted: 0,
            actual: 0,
            sortOrder: order++,
          });
        }
      }
      if (rows.length > 0) await prisma.budgetLineItem.createMany({ data: rows });
      return NextResponse.json({ seeded: rows.length });
    }

    // New lines default to a quantity of 1 unless the caller says otherwise.
    const quantity =
      body.quantity === undefined
        ? 1
        : body.quantity == null || body.quantity === ""
          ? null
          : Number(body.quantity);
    const rate = body.rate == null || body.rate === "" ? null : Number(body.rate);
    const vatPercent =
      body.vatPercent === undefined
        ? 20
        : body.vatPercent == null || body.vatPercent === ""
          ? null
          : Number(body.vatPercent);
    const computedBudgeted =
      quantity != null && rate != null
        ? quantity * rate
        : body.budgeted == null || body.budgeted === ""
          ? 0
          : Number(body.budgeted);
    const section = body.section || null;
    const item = await prisma.budgetLineItem.create({
      data: {
        productionId: id,
        category: section || body.category || "other",
        section,
        role: body.role || null,
        quantity,
        rate,
        vatPercent,
        description: body.description || "",
        budgeted: computedBudgeted,
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
      select: { productionId: true, budgeted: true, quantity: true, rate: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Resolve quantity/rate after the patch so we can recompute the line total
    // and tell whether the budgeted amount is effectively changing.
    const nextQuantity =
      body.quantity !== undefined
        ? body.quantity === "" || body.quantity == null
          ? null
          : Number(body.quantity)
        : existing.quantity;
    const nextRate =
      body.rate !== undefined
        ? body.rate === "" || body.rate == null
          ? null
          : Number(body.rate)
        : existing.rate;
    const recompute = body.quantity !== undefined || body.rate !== undefined;
    const computedBudgeted =
      nextQuantity != null && nextRate != null
        ? nextQuantity * nextRate
        : body.budgeted !== undefined
          ? body.budgeted === "" || body.budgeted == null
            ? 0
            : Number(body.budgeted)
          : existing.budgeted;

    const changesBudgeted =
      (body.budgeted !== undefined || recompute) && computedBudgeted !== existing.budgeted;
    const blocked = await budgetGuard(existing.productionId, {
      budgeted: changesBudgeted,
      actual: body.actual !== undefined,
    });
    if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

    const data: Record<string, unknown> = {};
    if (body.category !== undefined) data.category = body.category;
    if (body.section !== undefined) data.section = body.section || null;
    if (body.role !== undefined) data.role = body.role || null;
    if (body.quantity !== undefined) data.quantity = nextQuantity;
    if (body.rate !== undefined) data.rate = nextRate;
    if (body.vatPercent !== undefined)
      data.vatPercent =
        body.vatPercent === "" || body.vatPercent == null ? null : Number(body.vatPercent);
    if (body.description !== undefined) data.description = body.description;
    // budgeted follows qty×rate when either is set, otherwise the manual value.
    if (body.budgeted !== undefined || recompute) data.budgeted = computedBudgeted;
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
