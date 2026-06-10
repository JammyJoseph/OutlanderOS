import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { getProjectFinancialSummaries } from '@/lib/finance-projects'

export const dynamic = 'force-dynamic'

// All projects with financial activity: budget, costs logged, paid (Xero),
// remaining, and overage status.
export const GET = withAuth(async () => {
  try {
    const projects = await getProjectFinancialSummaries()
    const totalBudget = projects.reduce((s, p) => s + p.totalBudget, 0)
    const totalCosts = projects.reduce((s, p) => s + p.totalCosts, 0)
    return NextResponse.json({ projects, totalBudget, totalCosts, count: projects.length })
  } catch (e) {
    return NextResponse.json({ projects: [], totalBudget: 0, totalCosts: 0, count: 0, error: String(e) }, { status: 500 })
  }
})
