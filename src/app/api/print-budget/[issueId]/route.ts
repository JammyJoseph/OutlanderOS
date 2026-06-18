import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import {
  groupBudgetRows,
  computeBudgetRow,
  computeBudgetTotals,
  type MagazinePage,
  type LinkedDeal,
  type LinkedProduction,
} from "@/lib/magazine-plan";

// GET /api/print-budget/[issueId]
// issueId is the MagazinePlan.id. Returns the budget rows (one per feature) with
// linked deal/production names + values resolved and margins computed, plus the
// totals row and the active deal/production lists used by the link pickers.
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> }
) => {
  const { issueId } = (await params)!;
  try {
    const plan = await prisma.magazinePlan.findUnique({ where: { id: issueId } });
    if (!plan) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

    const pages = (Array.isArray(plan.pages) ? plan.pages : []) as unknown as MagazinePage[];
    const groups = groupBudgetRows(pages);

    // Resolve only the links actually used by anchor pages.
    const campaignIds = new Set<string>();
    const productionIds = new Set<string>();
    for (const g of groups) {
      const a = pages[g.anchorIndex];
      if (a?.campaignId) campaignIds.add(a.campaignId);
      if (a?.productionId) productionIds.add(a.productionId);
    }

    const [linkedCampaigns, linkedProductions] = await Promise.all([
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
      linkedCampaigns.map((c) => [
        c.id,
        { id: c.id, title: c.title, client: c.client?.name ?? null, dealValue: c.dealValue ?? c.value ?? null },
      ])
    );
    const prodMap = new Map<string, LinkedProduction>(
      linkedProductions.map((p) => [p.id, { id: p.id, title: p.title, actual: productionActual(p) }])
    );

    const rows = groups.map((g) => {
      const anchor = pages[g.anchorIndex];
      const deal = anchor?.campaignId ? dealMap.get(anchor.campaignId) ?? null : null;
      const production = anchor?.productionId ? prodMap.get(anchor.productionId) ?? null : null;
      return computeBudgetRow(g, anchor, deal, production);
    });

    const totals = computeBudgetTotals(rows);

    // Active deals + productions for the link pickers (archived hidden).
    const [deals, productions] = await Promise.all([
      prisma.campaign.findMany({
        where: { archived: false },
        select: { id: true, title: true, dealValue: true, value: true, jobType: true, dealTypes: true, client: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.production.findMany({
        where: { archived: false },
        select: { id: true, title: true, clientName: true, budgetActual: true, budgetItems: { select: { actual: true } } },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
    ]);

    return NextResponse.json({
      issue: { id: plan.id, issueNumber: plan.issueNumber, issueName: plan.issueName },
      rows,
      totals,
      deals: deals.map((d) => ({
        id: d.id,
        title: d.title,
        client: d.client?.name ?? null,
        dealValue: d.dealValue ?? d.value ?? null,
        jobType: d.jobType,
        dealTypes: d.dealTypes,
      })),
      productions: productions.map((p) => ({
        id: p.id,
        title: p.title,
        client: p.clientName,
        actual: productionActual(p),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
});
