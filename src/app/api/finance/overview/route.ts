import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import {
  getXeroProfitAndLoss,
  getXeroBankBalance,
  getXeroInvoices,
  getXeroBills,
  getXeroStatus,
} from '@/lib/xero-finance'
import { overageStatusFor } from '@/lib/finance-projects'

export const dynamic = 'force-dynamic'

// Finance dashboard KPIs: outstanding receivables/payables (Xero), invoices
// pending approval, active projects with budget, overage counts, P&L snapshot,
// bank balance, and recent invoice activity. Defaults to year-to-date P&L;
// accepts ?from=YYYY-MM-DD&to=YYYY-MM-DD. Degrades gracefully without Xero.
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const now = new Date()
    const params = request.nextUrl.searchParams
    const fromDate = params.get('from') || `${now.getFullYear()}-01-01`
    const toDate = params.get('to') || now.toISOString().split('T')[0]

    const [status, pl, bank, invoices, bills, submissions, budgets, costSums] = await Promise.all([
      getXeroStatus(),
      getXeroProfitAndLoss(fromDate, toDate),
      getXeroBankBalance(),
      getXeroInvoices('AUTHORISED'),
      getXeroBills('AUTHORISED'),
      prisma.invoiceSubmission.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 }),
      prisma.campaignBudget.findMany(),
      prisma.costEntry.groupBy({ by: ['campaignBudgetId'], _sum: { amount: true } }),
    ])

    const nowMs = Date.now()
    const outstandingReceivables = invoices.reduce((s, i) => s + i.amountDue, 0)
    const overdueReceivables = invoices.reduce((s, i) => {
      const due = i.dueDate ? new Date(i.dueDate).getTime() : nowMs
      return due < nowMs ? s + i.amountDue : s
    }, 0)
    const overdueReceivableCount = invoices.filter((i) => {
      const due = i.dueDate ? new Date(i.dueDate).getTime() : nowMs
      return due < nowMs
    }).length
    const outstandingPayables = bills.reduce((s, b) => s + b.amountDue, 0)

    const pendingApprovals = submissions.filter((s) => s.status === 'RECEIVED' || s.status === 'UNDER_REVIEW').length
    const flaggedCount = submissions.filter((s) => s.flagged && s.status !== 'PAID' && s.status !== 'REJECTED').length

    // Overage detection: CampaignBudget.totalBudget vs summed CostEntry amounts.
    const costsByBudget = new Map<string, number>()
    for (const c of costSums) {
      if (c.campaignBudgetId) costsByBudget.set(c.campaignBudgetId, c._sum.amount ?? 0)
    }
    const overageAlerts = budgets
      .map((b) => {
        const costs = costsByBudget.get(b.id) ?? 0
        return {
          id: b.id,
          campaignName: b.campaignName,
          clientName: b.clientName,
          totalBudget: b.totalBudget,
          totalCosts: costs,
          overBy: costs - b.totalBudget,
          overageStatus: overageStatusFor(costs, b.totalBudget),
        }
      })
      .filter((p) => p.overageStatus === 'OVERAGE' || p.overageStatus === 'WARNING')
      .sort((a, b) => b.overBy - a.overBy)

    const activeProjects = budgets.filter((b) => b.totalBudget > 0 && b.status !== 'RECONCILED').length

    // Recent activity: latest supplier submissions + latest Xero invoices.
    const recentActivity = [
      ...submissions.slice(0, 10).map((s) => ({
        type: 'incoming' as const,
        id: s.id,
        label: s.supplierName,
        detail: s.description ?? s.emailSubject ?? null,
        amount: s.amount,
        status: s.status,
        flagged: s.flagged,
        date: s.updatedAt.toISOString(),
      })),
      ...invoices.slice(0, 10).map((i) => ({
        type: 'outgoing' as const,
        id: i.id,
        label: i.contact || 'Unknown client',
        detail: null,
        amount: i.amount,
        status: i.status,
        flagged: false,
        date: i.date,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12)

    return NextResponse.json({
      xeroConnected: status.connected,
      xeroError: status.error ?? null,
      organisation: status.organisation ?? null,
      profitAndLoss: pl,
      bankBalance: bank,
      outstandingReceivables,
      overdueReceivables,
      overdueReceivableCount,
      outstandingPayables,
      receivableCount: invoices.length,
      payableCount: bills.length,
      pendingApprovals,
      flaggedCount,
      activeProjects,
      overageAlerts,
      recentActivity,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
})
