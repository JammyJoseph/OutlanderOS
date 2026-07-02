import { NextResponse } from 'next/server'
import { withAdminDb } from '@/lib/auth'
import { getProjectFinancialSummaries } from '@/lib/finance-projects'

export const dynamic = 'force-dynamic'

// All projects with financial activity: budget, costs logged, paid (Xero),
// remaining, and overage status.
export const GET = withAdminDb(async () => {
  try {
    const projects = await getProjectFinancialSummaries()
    const totalBudget = projects.reduce((s, p) => s + p.budgetExVat, 0)
    const totalCosts = projects.reduce((s, p) => s + p.spent, 0)
    return NextResponse.json({ projects, totalBudget, totalCosts, count: projects.length })
  } catch (e) {
    return NextResponse.json({ projects: [], totalBudget: 0, totalCosts: 0, count: 0, error: "An error occurred" }, { status: 500 })
  }
})
