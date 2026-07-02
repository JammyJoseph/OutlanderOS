import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminDb } from "@/lib/auth";
import {
  groupBudgetRows,
  computeBudgetRow,
  computeBudgetTotals,
  type MagazinePage,
  type LinkedDeal,
  type LinkedProduction,
} from "@/lib/magazine-plan";

export const dynamic = "force-dynamic";

// GET /api/finance/print-pl
// Aggregated Print P&L for the Finance portal: per-issue revenue / production
// cost / print cost / margin, a split of paid (advertiser revenue) vs at-cost
// (editorial) features, and the magazine-wide totals across every issue.
export const GET = withAdminDb(async () => {
  try {
    const plans = await prisma.magazinePlan.findMany({ orderBy: { issueNumber: "desc" } });

    // Resolve every link across all issues in two batched queries.
    const campaignIds = new Set<string>();
    const productionIds = new Set<string>();
    const planRows = plans.map((plan) => {
      const pages = (Array.isArray(plan.pages) ? plan.pages : []) as unknown as MagazinePage[];
      const groups = groupBudgetRows(pages);
      for (const g of groups) {
        const a = pages[g.anchorIndex];
        if (a?.campaignId) campaignIds.add(a.campaignId);
        if (a?.productionId) productionIds.add(a.productionId);
      }
      return { plan, pages, groups };
    });

    const [campaigns, productions] = await Promise.all([
      campaignIds.size
        ? prisma.campaign.findMany({
            where: { id: { in: [...campaignIds] } },
            select: { id: true, title: true, dealValue: true, value: true, client: { select: { name: true } } },
          })
        : Promise.resolve([]),
      productionIds.size
        ? prisma.production.findMany({
            where: { id: { in: [...productionIds] } },
            select: { id: true, title: true, budgetActual: true, budgetItems: { select: { actual: true } } },
          })
        : Promise.resolve([]),
    ]);

    const productionActual = (p: { budgetActual: number | null; budgetItems: { actual: number }[] }) => {
      const fromItems = p.budgetItems.reduce((s, i) => s + (i.actual ?? 0), 0);
      return fromItems > 0 ? fromItems : p.budgetActual ?? 0;
    };

    const dealMap = new Map<string, LinkedDeal>(
      campaigns.map((c) => [
        c.id,
        { id: c.id, title: c.title, client: c.client?.name ?? null, dealValue: c.dealValue ?? c.value ?? null },
      ])
    );
    const prodMap = new Map<string, LinkedProduction>(
      productions.map((p) => [p.id, { id: p.id, title: p.title, actual: productionActual(p) }])
    );

    const issues = planRows.map(({ plan, pages, groups }) => {
      const rows = groups.map((g) => {
        const anchor = pages[g.anchorIndex];
        const deal = anchor?.campaignId ? dealMap.get(anchor.campaignId) ?? null : null;
        const production = anchor?.productionId ? prodMap.get(anchor.productionId) ?? null : null;
        return computeBudgetRow(g, anchor, deal, production);
      });
      const totals = computeBudgetTotals(rows);
      const paidRows = rows.filter((r) => r.revenue > 0);
      const atCostRows = rows.filter((r) => r.revenue === 0 && r.type !== "Space");
      return {
        id: plan.id,
        issueNumber: plan.issueNumber,
        issueName: plan.issueName,
        totalPages: plan.totalPages,
        revenue: totals.revenue,
        productionCost: totals.productionCost,
        printCost: totals.printCost,
        margin: totals.margin,
        revenuePerPage: totals.revenuePerPage,
        costPerPage: totals.costPerPage,
        paidFeatures: paidRows.length,
        atCostFeatures: atCostRows.length,
        paidRevenue: paidRows.reduce((s, r) => s + r.revenue, 0),
        atCostSpend: atCostRows.reduce((s, r) => s + r.productionCost + r.printCost, 0),
      };
    });

    const totals = {
      revenue: issues.reduce((s, i) => s + i.revenue, 0),
      productionCost: issues.reduce((s, i) => s + i.productionCost, 0),
      printCost: issues.reduce((s, i) => s + i.printCost, 0),
      margin: issues.reduce((s, i) => s + i.margin, 0),
      paidFeatures: issues.reduce((s, i) => s + i.paidFeatures, 0),
      atCostFeatures: issues.reduce((s, i) => s + i.atCostFeatures, 0),
    };

    return NextResponse.json({ issues, totals });
  } catch (e) {
    return NextResponse.json({ issues: [], totals: null, error: "An error occurred" }, { status: 500 });
  }
});
