import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminDb } from '@/lib/auth'
import { getXeroInvoices, getXeroStatus } from '@/lib/xero-finance'
import { overageStatusFor } from '@/lib/finance-projects'
import { parseAllocations, productionAllocationOf } from '@/lib/deal-stages'
import { computeEconomics, DEFAULT_PRODUCTION_MARGIN_PCT } from '@/lib/deal-economics'

export const dynamic = 'force-dynamic'

// Detailed project financial view: deal economics (margin + allocations),
// production budget vs actuals, margin analysis, cost line items grouped by
// category, supplier invoices coded to the project, and Xero payment status
// for the client's invoices.
export const GET = withAdminDb(async (request: NextRequest, context) => {
  try {
    const params = context.params ? await context.params : {}
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const budget = await prisma.campaignBudget.findUnique({ where: { id } })
    if (!budget) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const [costs, invoices, production, deal, xeroStatus, xeroInvoices] = await Promise.all([
      prisma.costEntry.findMany({ where: { campaignBudgetId: id }, orderBy: { date: 'desc' } }),
      prisma.invoiceSubmission.findMany({ where: { campaignBudgetId: id }, orderBy: { receivedAt: 'desc' } }),
      budget.productionId
        ? prisma.production.findUnique({
            where: { id: budget.productionId },
            select: {
              id: true,
              title: true,
              status: true,
              budgetTotal: true,
              productionBudgetStatus: true,
              budgetItems: { select: { category: true, budgeted: true, actual: true } },
            },
          })
        : Promise.resolve(null),
      budget.campaignId
        ? prisma.campaign.findUnique({
            where: { id: budget.campaignId },
            select: {
              id: true,
              title: true,
              stage: true,
              value: true,
              marginPercent: true,
              marginAmount: true,
              allocations: true,
              dealValue: true,
              mediaSpend: true,
              productionMarginPct: true,
              budgetLocked: true,
              budgetLockedAt: true,
              client: { select: { name: true } },
            },
          })
        : Promise.resolve(null),
      getXeroStatus().catch(() => ({ connected: false, error: 'unavailable' })),
      getXeroInvoices().catch(() => []),
    ])

    // Deliverables on the linked deal — contracted vs additional (scope creep).
    // Additional deliverables carry an overage cost billed on top of the deal,
    // which flows through to revenue in the P&L.
    const deliverables = budget.campaignId
      ? await prisma.deliverable.findMany({
          where: { campaignId: budget.campaignId },
          orderBy: [{ isAdditional: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }],
        })
      : []
    const contractedDeliverables = deliverables.filter((d) => !d.isAdditional)
    const additionalDeliverables = deliverables.filter((d) => d.isAdditional)
    const additionalOverage = additionalDeliverables.reduce((s, d) => s + (d.overageCost ?? 0), 0)

    const totalCosts = costs.reduce((s, c) => s + c.amount, 0)

    // Cost line items grouped by category.
    const byCategory = new Map<string, { category: string; total: number; entries: typeof costs }>()
    for (const c of costs) {
      const key = c.category || 'other'
      const group = byCategory.get(key) ?? { category: key, total: 0, entries: [] }
      group.total += c.amount
      group.entries.push(c)
      byCategory.set(key, group)
    }
    const costsByCategory = Array.from(byCategory.values()).sort((a, b) => b.total - a.total)

    // Client invoices in Xero, matched by contact name.
    const clientKey = budget.clientName.trim().toLowerCase()
    const clientInvoices = xeroInvoices.filter((i) => i.contact.trim().toLowerCase() === clientKey)
    const totalPaid = clientInvoices.reduce((s, i) => s + i.amountPaid, 0)
    const totalInvoiced = clientInvoices.reduce((s, i) => s + i.amount, 0)

    // ===== Budget & margin waterfall =====
    const allocations = deal ? parseAllocations(deal.allocations) : []
    const dealTotal = deal?.value ?? budget.totalBudget
    const targetMarginAmount = deal?.marginAmount ?? null
    const targetMarginPercent =
      deal?.marginPercent ?? (targetMarginAmount != null && dealTotal > 0 ? (targetMarginAmount / dealTotal) * 100 : null)

    // Production: allocation from the deal, line-item budget + actuals.
    const productionAllocation = allocations.length
      ? productionAllocationOf(allocations)
      : production?.budgetTotal ?? budget.productionBudget
    const productionBudgeted = (production?.budgetItems ?? []).reduce((s, i) => s + (i.budgeted || 0), 0)
    const productionActuals = (production?.budgetItems ?? []).reduce((s, i) => s + (i.actual || 0), 0)
    const productionSavings = productionAllocation - productionActuals

    // Simplified split (media vs production) — Noah's model. Derived from the
    // deal's stored inputs, falling back to the allocations for older deals.
    const mediaAllocated = allocations
      .filter((a) => !a.isProductionBudget)
      .reduce((s, a) => s + a.amount, 0)
    const eco = computeEconomics({
      dealValue: deal?.dealValue ?? dealTotal,
      mediaSpend: deal?.mediaSpend ?? mediaAllocated,
      productionMarginPct: deal?.productionMarginPct ?? DEFAULT_PRODUCTION_MARGIN_PCT,
    })
    const mediaSpend = eco.mediaSpend
    const productionBudget = eco.productionBudget // company margin + hard costs
    const productionMarginPct = eco.productionMarginPct
    // Total company revenue = media spend + production margin + production savings.
    const totalCompanyRevenue = mediaSpend + (targetMarginAmount ?? eco.companyMargin) + productionSavings

    // Margin analysis: production savings flow straight into the margin.
    const actualMarginAmount = targetMarginAmount != null ? targetMarginAmount + productionSavings : null
    const actualMarginPercent =
      actualMarginAmount != null && dealTotal > 0 ? (actualMarginAmount / dealTotal) * 100 : null

    // Final P&L: revenue is the deal total; non-production allocations are
    // taken at their allocated amounts, production at actuals.
    const nonProductionAllocated = allocations
      .filter((a) => !a.isProductionBudget)
      .reduce((s, a) => s + a.amount, 0)
    const plCosts = nonProductionAllocated + productionActuals
    // Scope-creep overages are extra revenue from the client.
    const plRevenue = dealTotal + additionalOverage
    const grossProfit = plRevenue - plCosts
    const grossMarginPercent = plRevenue > 0 ? (grossProfit / plRevenue) * 100 : null

    // Invoice tracking: supplier invoices vs what production reported.
    const settledStatuses = ['PAID', 'REJECTED']
    const invoicesTotal = invoices
      .filter((i) => i.status !== 'REJECTED')
      .reduce((s, i) => s + (i.amount ?? 0), 0)
    const invoicesPaid = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + (i.amount ?? 0), 0)
    const invoicesOutstanding = invoices.filter((i) => !settledStatuses.includes(i.status))

    return NextResponse.json({
      project: {
        ...budget,
        totalCosts,
        remaining: budget.totalBudget - totalCosts,
        spendPct: budget.totalBudget > 0 ? (totalCosts / budget.totalBudget) * 100 : null,
        overageStatus: overageStatusFor(totalCosts, budget.totalBudget),
      },
      production,
      deal,
      economics: {
        dealTotal,
        targetMarginAmount,
        targetMarginPercent,
        allocations,
        budgetLocked: deal?.budgetLocked ?? false,
        // Simplified media-vs-production breakdown.
        mediaSpend,
        productionBudget,
        productionMarginPct,
        totalCompanyRevenue,
        productionAllocation,
        productionBudgeted,
        productionActuals,
        productionSavings,
        productionBudgetStatus: production?.productionBudgetStatus ?? null,
        actualMarginAmount,
        actualMarginPercent,
        // Scope-creep deliverables: contracted vs additional + overage revenue.
        deliverables: {
          contractedCount: contractedDeliverables.length,
          additionalCount: additionalDeliverables.length,
          additionalOverage,
          additional: additionalDeliverables.map((d) => ({
            id: d.id,
            title: d.title ?? d.type,
            overageCost: d.overageCost ?? 0,
            approvedBy: d.approvedBy,
            status: d.status,
          })),
        },
        finalPL: {
          revenue: plRevenue,
          dealValue: dealTotal,
          additionalOverage,
          nonProductionAllocated,
          productionActuals,
          costs: plCosts,
          grossProfit,
          grossMarginPercent,
        },
      },
      invoiceTracking: {
        invoicesTotal,
        invoicesPaid,
        invoicesUnpaid: invoicesTotal - invoicesPaid,
        outstandingCount: invoicesOutstanding.length,
        outstandingAmount: invoicesOutstanding.reduce((s, i) => s + (i.amount ?? 0), 0),
        vsProductionActuals: invoicesTotal - productionActuals,
      },
      costsByCategory,
      invoices,
      xero: {
        connected: xeroStatus.connected,
        clientInvoices,
        totalInvoiced,
        totalPaid,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
})
