import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { validateRequired, sanitizeString } from "@/lib/validate";

// GET /api/commercial/projects — list all campaign projects with budget + production status
export const GET = withAuth(async () => {
  try {
    const budgets = await prisma.campaignBudget.findMany({
      orderBy: { updatedAt: "desc" },
    });

    // Pull the linked productions in one query, then stitch them in.
    const productionIds = budgets
      .map((b) => b.productionId)
      .filter((id): id is string => Boolean(id));
    const productions = productionIds.length
      ? await prisma.production.findMany({
          where: { id: { in: productionIds } },
          select: {
            id: true,
            title: true,
            status: true,
            type: true,
            budgetTotal: true,
            budgetActual: true,
            shootDates: true,
          },
        })
      : [];
    const prodById = new Map(productions.map((p) => [p.id, p]));

    const projects = budgets.map((b) => ({
      ...b,
      production: b.productionId ? prodById.get(b.productionId) ?? null : null,
    }));

    return NextResponse.json({ projects });
  } catch (e) {
    return NextResponse.json({ projects: [], error: "An error occurred" }, { status: 500 });
  }
});

// POST /api/commercial/projects — creates a CampaignBudget + optionally a Production
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  const body = await request.json();

  const missing = validateRequired(body, ["campaignName", "clientName"]);
  if (missing) return NextResponse.json({ error: missing }, { status: 400 });

  const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
  const totalBudget = num(body.totalBudget);
  const productionBudget = num(body.productionBudget);
  const mediaBudget = num(body.mediaBudget);
  const internalBudget = num(body.internalBudget);
  const otherBudget = num(body.otherBudget);

  const splitSum = productionBudget + mediaBudget + internalBudget + otherBudget;
  if (totalBudget > 0 && Math.abs(splitSum - totalBudget) > 0.5) {
    return NextResponse.json(
      {
        error: `Budget splits (£${splitSum.toLocaleString()}) must equal the total campaign budget (£${totalBudget.toLocaleString()}).`,
      },
      { status: 400 }
    );
  }

  const requiresProduction = Boolean(body.requiresProduction);

  try {
    const budget = await prisma.campaignBudget.create({
      data: {
        campaignName: sanitizeString(body.campaignName, 300),
        clientName: sanitizeString(body.clientName, 300),
        trelloCardId: body.trelloCardId || null,
        trelloCardName: body.trelloCardName || null,
        totalBudget,
        productionBudget,
        mediaBudget,
        internalBudget,
        otherBudget,
        notes: body.notes ? sanitizeString(body.notes, 4000) : null,
        status: "SUBMITTED",
        submittedBy: user.userId,
      },
    });

    let production = null;
    if (requiresProduction) {
      const shootDates = Array.isArray(body.shootDates)
        ? body.shootDates.filter((d: string) => d).map((d: string) => new Date(d))
        : [];

      production = await prisma.production.create({
        data: {
          title: sanitizeString(body.campaignName, 300),
          clientName: sanitizeString(body.clientName, 300),
          brief: body.productionBrief ? sanitizeString(body.productionBrief, 4000) : null,
          type: "COMMERCIAL",
          budgetTotal: productionBudget,
          campaignBudgetId: budget.id,
          trelloCardId: body.trelloCardId || null,
          status: "DRAFT",
          shootDates,
        },
      });

      // Link the budget back to the production it spawned.
      await prisma.campaignBudget.update({
        where: { id: budget.id },
        data: { productionId: production.id },
      });
    }

    return NextResponse.json({
      project: { ...budget, productionId: production?.id ?? null, production },
    });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});
