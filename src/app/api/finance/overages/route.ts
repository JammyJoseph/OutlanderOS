import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { getProjectFinancialSummaries } from '@/lib/finance-projects'

export const dynamic = 'force-dynamic'

// Projects over budget (OVERAGE) or near it (WARNING, >80% spent).
export const GET = withAuth(async () => {
  try {
    const projects = await getProjectFinancialSummaries()
    const overages = projects.filter((p) => p.overageStatus === 'OVERAGE')
    const warnings = projects.filter((p) => p.overageStatus === 'WARNING')
    return NextResponse.json({
      overages,
      warnings,
      overageCount: overages.length,
      warningCount: warnings.length,
    })
  } catch (e) {
    return NextResponse.json({ overages: [], warnings: [], overageCount: 0, warningCount: 0, error: String(e) }, { status: 500 })
  }
})
