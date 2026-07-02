import prisma from '@/lib/prisma'
import { getXeroInvoices } from '@/lib/xero-finance'

// Single source of truth for project financial health:
// Commercial sets the budget (CampaignBudget) → Production logs costs
// (CostEntry, coded to the campaignBudgetId) → Finance reads the rollup here.
//
// Finance also surfaces production projects that carry a line-item budget but
// never went through the Commercial "start project" flow (e.g. editorial
// shoots). Those appear as their own folders so no budget lives in isolation.

export type OverageStatus = 'HEALTHY' | 'WARNING' | 'OVERAGE' | 'NO_BUDGET'
export type ProjectSource = 'commercial' | 'production'

export interface ProjectFinancialSummary {
  id: string
  source: ProjectSource // commercial = CampaignBudget folder; production = standalone production
  campaignName: string
  clientName: string
  clientId: string | null
  status: string
  productionId: string | null
  deal: { id: string; title: string; stage: string } | null // originating Commercial deal
  targetMarginAmount: number | null // company margin set on the deal
  targetMarginPercent: number | null
  budgetLocked: boolean // deal economics finalised in Commercial
  totalBudget: number // deal/finance budget (commercial folders); line-item budget for productions
  budgetExVat: number // headline budget exc. VAT — production line items when present, else totalBudget
  productionBudget: number
  mediaBudget: number
  internalBudget: number
  otherBudget: number
  totalCosts: number // manual cost entries coded to this folder
  productionActuals: number // sum of production line-item actuals
  spent: number // canonical spend for list/variance views (cost entries, else actuals)
  totalPaid: number // Xero payments received from this client's invoices
  remaining: number
  spendPct: number | null // costs as % of budget; null when no budget
  overageStatus: OverageStatus
  pendingInvoices: number // unsettled supplier invoices coded to this project
  shootDate: Date | null // earliest production shoot date, if any
  archived: boolean // parent deal/production archived — folder kept for history
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

type BudgetItemLite = { quantity: number | null; rate: number | null; budgeted: number; actual: number }

// Line-item budget exc. VAT: qty × unit cost when both set, else the manual
// budgeted figure. Mirrors lineTotal() in the production budget UI. VAT is never
// included — the platform rule is that budget figures always exclude VAT.
export function productionBudgetExVat(items: BudgetItemLite[]): number {
  return items.reduce(
    (s, it) => s + (it.quantity != null && it.rate != null ? it.quantity * it.rate : it.budgeted || 0),
    0
  )
}

export function productionActualsOf(items: BudgetItemLite[]): number {
  return items.reduce((s, it) => s + (it.actual || 0), 0)
}

function earliestShootDate(dates: Date[]): Date | null {
  if (!dates || dates.length === 0) return null
  return dates.reduce((min, d) => (d < min ? d : min))
}

// Builds the financial summary for every finance folder (CampaignBudget) plus
// every production project that carries a line-item budget but has no folder of
// its own. Xero failures degrade to totalPaid=0 — internal budget and cost data
// always renders.
export async function getProjectFinancialSummaries(): Promise<ProjectFinancialSummary[]> {
  const [budgets, costSums, pendingCounts, xeroInvoices, clients] = await Promise.all([
    prisma.campaignBudget.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.costEntry.groupBy({ by: ['campaignBudgetId'], _sum: { amount: true } }),
    prisma.invoiceSubmission.groupBy({
      by: ['campaignBudgetId'],
      where: { status: { notIn: ['PAID', 'REJECTED'] } },
      _count: { _all: true },
    }),
    getXeroInvoices().catch(() => []),
    prisma.client.findMany({ select: { id: true, name: true } }),
  ])

  // Resolve a client name → id (folders store clientName, not clientId).
  const clientIdByName = new Map(clients.map((c) => [c.name.trim().toLowerCase(), c.id]))

  // Originating Commercial deals for the folders that have one.
  const campaignIds = budgets.map((b) => b.campaignId).filter((id): id is string => !!id)
  const campaigns = campaignIds.length
    ? await prisma.campaign.findMany({
        where: { id: { in: campaignIds } },
        select: {
          id: true,
          title: true,
          stage: true,
          clientId: true,
          marginAmount: true,
          marginPercent: true,
          budgetLocked: true,
          archived: true,
        },
      })
    : []
  const dealById = new Map(campaigns.map((c) => [c.id, c]))

  // Every production that is either referenced by a folder or carries a budget
  // of its own. Line items drive the exc-VAT budget, actuals, and shoot date.
  const referencedProductionIds = budgets
    .map((b) => b.productionId)
    .filter((id): id is string => !!id)
  const productions = await prisma.production.findMany({
    where: {
      OR: [{ id: { in: referencedProductionIds } }, { budgetItems: { some: {} } }],
    },
    select: {
      id: true,
      title: true,
      clientName: true,
      status: true,
      productionBudgetStatus: true,
      shootDates: true,
      archived: true,
      updatedAt: true,
      campaign: { select: { id: true, title: true, stage: true, clientId: true, client: { select: { name: true } } } },
      budgetItems: { select: { quantity: true, rate: true, budgeted: true, actual: true } },
    },
  })
  const productionById = new Map(productions.map((p) => [p.id, p]))

  const costsByBudget = new Map<string, number>()
  for (const c of costSums) {
    if (c.campaignBudgetId) costsByBudget.set(c.campaignBudgetId, c._sum.amount ?? 0)
  }
  const pendingByBudget = new Map<string, number>()
  for (const p of pendingCounts) {
    if (p.campaignBudgetId) pendingByBudget.set(p.campaignBudgetId, p._count._all)
  }
  const paid = paidByClient(xeroInvoices)

  // ── Commercial finance folders (CampaignBudget) ──
  const folderSummaries: ProjectFinancialSummary[] = budgets.map((b) => {
    const totalCosts = costsByBudget.get(b.id) ?? 0
    const campaign = (b.campaignId && dealById.get(b.campaignId)) || null
    const production = b.productionId ? productionById.get(b.productionId) : null
    const items = production?.budgetItems ?? []
    const prodBudget = production ? productionBudgetExVat(items) : 0
    const prodActuals = production ? productionActualsOf(items) : 0
    // Headline exc-VAT budget: real production line items when present, else the
    // finance budget carried on the folder.
    const budgetExVat = production && prodBudget > 0 ? prodBudget : b.totalBudget
    const spent = totalCosts > 0 ? totalCosts : prodActuals
    return {
      id: b.id,
      source: 'commercial',
      campaignName: b.campaignName,
      clientName: b.clientName,
      clientId: campaign?.clientId ?? clientIdByName.get(b.clientName.trim().toLowerCase()) ?? null,
      status: b.status,
      productionId: b.productionId,
      deal: campaign ? { id: campaign.id, title: campaign.title, stage: campaign.stage } : null,
      targetMarginAmount: campaign?.marginAmount ?? null,
      targetMarginPercent: campaign?.marginPercent ?? null,
      budgetLocked: campaign?.budgetLocked ?? false,
      totalBudget: b.totalBudget,
      budgetExVat,
      productionBudget: b.productionBudget,
      mediaBudget: b.mediaBudget,
      internalBudget: b.internalBudget,
      otherBudget: b.otherBudget,
      totalCosts,
      productionActuals: prodActuals,
      spent,
      totalPaid: paid.get(b.clientName.trim().toLowerCase()) ?? 0,
      remaining: b.totalBudget - totalCosts,
      spendPct: b.totalBudget > 0 ? (totalCosts / b.totalBudget) * 100 : null,
      overageStatus: overageStatusFor(totalCosts, b.totalBudget),
      pendingInvoices: pendingByBudget.get(b.id) ?? 0,
      shootDate: production ? earliestShootDate(production.shootDates) : null,
      archived:
        (campaign?.archived ?? false) || (production ? production.archived : false),
      updatedAt: b.updatedAt,
    }
  })

  // ── Standalone productions (budget line items, but no finance folder) ──
  const standalone: ProjectFinancialSummary[] = productions
    .filter((p) => !referencedProductionIds.includes(p.id) && p.budgetItems.length > 0)
    .map((p) => {
      const budgetExVat = productionBudgetExVat(p.budgetItems)
      const prodActuals = productionActualsOf(p.budgetItems)
      const clientName = p.clientName || p.campaign?.client?.name || 'Unassigned'
      const clientId = p.campaign?.clientId ?? clientIdByName.get(clientName.trim().toLowerCase()) ?? null
      return {
        id: `prod_${p.id}`,
        source: 'production',
        campaignName: p.title,
        clientName,
        clientId,
        status: p.productionBudgetStatus ?? p.status,
        productionId: p.id,
        deal: p.campaign ? { id: p.campaign.id, title: p.campaign.title, stage: p.campaign.stage } : null,
        targetMarginAmount: null,
        targetMarginPercent: null,
        budgetLocked: p.productionBudgetStatus === 'LOCKED' || p.productionBudgetStatus === 'FINAL',
        totalBudget: budgetExVat,
        budgetExVat,
        productionBudget: budgetExVat,
        mediaBudget: 0,
        internalBudget: 0,
        otherBudget: 0,
        totalCosts: prodActuals,
        productionActuals: prodActuals,
        spent: prodActuals,
        totalPaid: paid.get(clientName.trim().toLowerCase()) ?? 0,
        remaining: budgetExVat - prodActuals,
        spendPct: budgetExVat > 0 ? (prodActuals / budgetExVat) * 100 : null,
        overageStatus: overageStatusFor(prodActuals, budgetExVat),
        pendingInvoices: 0,
        shootDate: earliestShootDate(p.shootDates),
        archived: p.archived,
        updatedAt: p.updatedAt,
      }
    })

  // Most recent first, matching the folder ordering.
  return [...folderSummaries, ...standalone].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  )
}
