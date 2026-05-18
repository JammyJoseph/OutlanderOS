import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Production actual spend rolled up into finance (connection #3).
// Returns the sum of budget line-item actual spend grouped by production.
export const GET = withAuth(async () => {
  try {
    const productions = await prisma.production.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: {
        id: true,
        title: true,
        clientName: true,
        budgetTotal: true,
        budgetItems: { select: { budgeted: true, actual: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const rows = productions.map((p) => {
      const budgeted = p.budgetItems.reduce((s, it) => s + (it.budgeted || 0), 0);
      const actual = p.budgetItems.reduce((s, it) => s + (it.actual || 0), 0);
      return {
        id: p.id,
        title: p.title,
        client: p.clientName,
        campaignBudget: p.budgetTotal,
        budgeted,
        actual,
      };
    });

    const totalActual = rows.reduce((s, r) => s + r.actual, 0);
    const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0);

    return NextResponse.json({
      productions: rows,
      totalActual,
      totalBudgeted,
      count: rows.length,
    });
  } catch (e) {
    return NextResponse.json(
      { productions: [], totalActual: 0, totalBudgeted: 0, count: 0, error: String(e) },
      { status: 500 }
    );
  }
});
