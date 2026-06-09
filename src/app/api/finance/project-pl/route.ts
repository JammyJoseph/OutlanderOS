import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { getXeroProfitAndLoss, getXeroStatus } from '@/lib/xero-finance'

export const dynamic = 'force-dynamic'

// Per-project P&L: budget (CampaignBudget) vs actual logged costs (CostEntry)
// vs the Xero company P&L overlay. Internal data always renders even if Xero
// is offline.
export const GET = withAuth(async () => {
  try {
    const now = new Date()
    const fromDate = `${now.getFullYear()}-01-01`
    const toDate = now.toISOString().split('T')[0]

    const [budgets, costs, status, xeroPL] = await Promise.all([
      prisma.campaignBudget.findMany({ orderBy: { updatedAt: 'desc' } }),
      prisma.costEntry.groupBy({
        by: ['campaignBudgetId'],
        _sum: { amount: true },
      }),
      getXeroStatus(),
      getXeroProfitAndLoss(fromDate, toDate),
    ])

    const actualByBudget = new Map<string, number>()
    for (const c of costs) {
      if (c.campaignBudgetId) actualByBudget.set(c.campaignBudgetId, c._sum.amount || 0)
    }

    const projects = budgets.map((b) => {
      const actual = actualByBudget.get(b.id) || 0
      return {
        id: b.id,
        clientName: b.clientName,
        campaignName: b.campaignName,
        productionId: b.productionId,
        status: b.status,
        totalBudget: b.totalBudget,
        actual,
        variance: b.totalBudget - actual,
      }
    })

    const totalBudget = projects.reduce((s, p) => s + p.totalBudget, 0)
    const totalActual = projects.reduce((s, p) => s + p.actual, 0)

    return NextResponse.json({
      projects,
      totalBudget,
      totalActual,
      totalVariance: totalBudget - totalActual,
      xeroConnected: status.connected,
      xeroError: status.error ?? null,
      xeroProfitAndLoss: { revenue: xeroPL.revenue, expenses: xeroPL.expenses, profit: xeroPL.profit },
      count: projects.length,
    })
  } catch (e) {
    return NextResponse.json({ projects: [], totalBudget: 0, totalActual: 0, count: 0, error: String(e) }, { status: 500 })
  }
})
