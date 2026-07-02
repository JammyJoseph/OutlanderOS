import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// GET /api/commercial/projects/[id] — single project with full detail
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  try {
    const budget = await prisma.campaignBudget.findUnique({ where: { id } });
    if (!budget) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const production = budget.productionId
      ? await prisma.production.findUnique({
          where: { id: budget.productionId },
          include: {
            budgetItems: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
            callSheets: {
              select: { id: true, status: true, shootDate: true, callTime: true, location: true },
            },
          },
        })
      : null;

    const costs = await prisma.costEntry.findMany({
      where: { campaignBudgetId: id },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ project: { ...budget, production, costs } });
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
});
