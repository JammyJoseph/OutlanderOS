import prisma from '@/lib/prisma'
import { getXeroInvoices } from '@/lib/xero-finance'

// Single source of truth for project financial health:
// Commercial sets the budget (CampaignBudget) → Production logs costs
// (CostEntry, coded to the campaignBudgetId) → Finance reads the rollup here.

export type OverageStatus = 'HEALTHY' | 'WARNING' | 'OVERAGE' | 'NO_BUDGET'

export interface ProjectFinancialSummary {
  id: string
  campaignName: string
  clientName: string
  status: string
  productionId: string | null
  deal: { id: string; title: string; stage: string } | null // originating Commercial deal
  targetMarginAmount: number | null // company margin set on the deal
  targetMarginPercent: number | null
  budgetLocked: boolean // deal economics finalised in Commercial
  totalBudget: number
  productionBudget: number
  mediaBudget: number
  internalBudget: number
  otherBudget: number
  totalCosts: number
  totalPaid: number // Xero payments received from this client's invoices
  remaining: number
  spendPct: number | null // costs as % of budget; null when no budget
  overageStatus: OverageStatus
  pendingInvoices: number // unsettled supplier invoices coded to this project
  updatedAt: Date
}

export function overageStatusFor(costs: number, budget: number): OverageStatus {
  if (budget <= 0) return costs > 0 ? 'OVERAGE' : 'NO_BUDGET'
  if (costs > budget) return 'OVERAGE'
  if (costs > budget * 0.8) return 'WARNING'
  return 'HEALTHY'
}

// Sums paid amounts on Xero ACCREC invoices per contact name (lowercased).
// Project → client matching is by name since Xero has no project dimension.
export function paidByClient(invoices: { contact: string; amountPaid: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const inv of invoices) {
    const key = inv.contact.trim().toLowerCase()
    if (!key) continue
    m.set(key, (m.get(key) ?? 0) + inv.amountPaid)
  }
  return m
}

// Builds the financial summary for every project (CampaignBudget) that has
// financial activity. Xero failures degrade to totalPaid=0 — internal budget
// and cost data always renders.
export async function getProjectFinancialSummaries(): Promise<ProjectFinancialSummary[]> {
  const [budgets, costSums, pendingCounts, xeroInvoices] = await Promise.all([
    prisma.campaignBudget.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.costEntry.groupBy({ by: ['campaignBudgetId'], _sum: { amount: true } }),
    prisma.invoiceSubmission.groupBy({
      by: ['campaignBudgetId'],
      where: { status: { notIn: ['PAID', 'REJECTED'] } },
      _count: { _all: true },
    }),
    getXeroInvoices().catch(() => []),
  ])

  // Originating Commercial deals for the folders that have one.
  const campaignIds = budgets.map((b) => b.campaignId).filter((id): id is string => !!id)
  const campaigns = campaignIds.length
    ? await prisma.campaign.findMany({
        where: { id: { in: campaignIds } },
        select: {
          id: true,
          title: true,
          stage: true,
          marginAmount: true,
          marginPercent: true,
          budgetLocked: true,
        },
      })
    : []
  const dealById = new Map(campaigns.map((c) => [c.id, c]))

  const costsByBudget = new Map<string, number>()
  for (const c of costSums) {
    if (c.campaignBudgetId) costsByBudget.set(c.campaignBudgetId, c._sum.amount ?? 0)
  }
  const pendingByBudget = new Map<string, number>()
  for (const p of pendingCounts) {
    if (p.campaignBudgetId) pendingByBudget.set(p.campaignBudgetId, p._count._all)
  }
  const paid = paidByClient(xeroInvoices)

  return budgets.map((b) => {
    const totalCosts = costsByBudget.get(b.id) ?? 0
    const campaign = (b.campaignId && dealById.get(b.campaignId)) || null
    return {
      id: b.id,
      campaignName: b.campaignName,
      clientName: b.clientName,
      status: b.status,
      productionId: b.productionId,
      deal: campaign ? { id: campaign.id, title: campaign.title, stage: campaign.stage } : null,
      targetMarginAmount: campaign?.marginAmount ?? null,
      targetMarginPercent: campaign?.marginPercent ?? null,
      budgetLocked: campaign?.budgetLocked ?? false,
      totalBudget: b.totalBudget,
      productionBudget: b.productionBudget,
      mediaBudget: b.mediaBudget,
      internalBudget: b.internalBudget,
      otherBudget: b.otherBudget,
      totalCosts,
      totalPaid: paid.get(b.clientName.trim().toLowerCase()) ?? 0,
      remaining: b.totalBudget - totalCosts,
      spendPct: b.totalBudget > 0 ? (totalCosts / b.totalBudget) * 100 : null,
      overageStatus: overageStatusFor(totalCosts, b.totalBudget),
      pendingInvoices: pendingByBudget.get(b.id) ?? 0,
      updatedAt: b.updatedAt,
    }
  })
}
