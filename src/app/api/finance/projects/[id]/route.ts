import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { getXeroInvoices, getXeroStatus } from '@/lib/xero-finance'
import { overageStatusFor } from '@/lib/finance-projects'

export const dynamic = 'force-dynamic'

// Detailed project financial view: budget splits, cost line items grouped by
// category, supplier invoices coded to the project, and Xero payment status
// for the client's invoices.
export const GET = withAuth(async (request: NextRequest, context) => {
  try {
    const params = context.params ? await context.params : {}
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const budget = await prisma.campaignBudget.findUnique({ where: { id } })
    if (!budget) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const [costs, invoices, production, xeroStatus, xeroInvoices] = await Promise.all([
      prisma.costEntry.findMany({ where: { campaignBudgetId: id }, orderBy: { date: 'desc' } }),
      prisma.invoiceSubmission.findMany({ where: { campaignBudgetId: id }, orderBy: { receivedAt: 'desc' } }),
      budget.productionId
        ? prisma.production.findUnique({
            where: { id: budget.productionId },
            select: { id: true, title: true, status: true, budgetTotal: true },
          })
        : Promise.resolve(null),
      getXeroStatus().catch(() => ({ connected: false, error: 'unavailable' })),
      getXeroInvoices().catch(() => []),
    ])

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

    return NextResponse.json({
      project: {
        ...budget,
        totalCosts,
        remaining: budget.totalBudget - totalCosts,
        spendPct: budget.totalBudget > 0 ? (totalCosts / budget.totalBudget) * 100 : null,
        overageStatus: overageStatusFor(totalCosts, budget.totalBudget),
      },
      production,
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
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
})
