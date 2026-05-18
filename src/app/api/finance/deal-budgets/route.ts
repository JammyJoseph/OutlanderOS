import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Deal budgets parsed from the Trello commercial pipeline (connection #2).
export const GET = withAuth(async () => {
  try {
    const deals = await prisma.financeDeal.findMany({
      orderBy: { budget: "desc" },
    });
    const total = deals.reduce((sum, d) => sum + d.budget, 0);
    return NextResponse.json({ deals, total, count: deals.length });
  } catch (e) {
    return NextResponse.json(
      { deals: [], total: 0, count: 0, error: String(e) },
      { status: 500 }
    );
  }
});
