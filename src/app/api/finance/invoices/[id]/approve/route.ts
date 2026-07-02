import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminDb } from '@/lib/auth'
import { overageStatusFor } from '@/lib/finance-projects'

export const dynamic = 'force-dynamic'

// Approve a supplier invoice. If the invoice is coded to a project, checks
// whether paying it would push that project's costs over budget — returns
// 409 with the overage details unless { confirmOverage: true } is sent.
export const PATCH = withAdminDb(async (request: NextRequest, context, user) => {
  try {
    const params = context.params ? await context.params : {}
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const invoice = await prisma.invoiceSubmission.findUnique({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (invoice.status === 'PAID' || invoice.status === 'REJECTED') {
      return NextResponse.json({ error: `Cannot approve an invoice that is ${invoice.status}` }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))

    // Overage check against the coded project's budget.
    let overage: {
      campaignName: string
      totalBudget: number
      currentCosts: number
      projectedCosts: number
      overBy: number
      status: string
    } | null = null

    if (invoice.campaignBudgetId && invoice.amount) {
      const budget = await prisma.campaignBudget.findUnique({ where: { id: invoice.campaignBudgetId } })
      if (budget) {
        const costSum = await prisma.costEntry.aggregate({
          where: { campaignBudgetId: budget.id },
          _sum: { amount: true },
        })
        const currentCosts = costSum._sum.amount ?? 0
        const projectedCosts = currentCosts + invoice.amount
        const projected = overageStatusFor(projectedCosts, budget.totalBudget)
        if (projected === 'OVERAGE' || projected === 'WARNING') {
          overage = {
            campaignName: budget.campaignName,
            totalBudget: budget.totalBudget,
            currentCosts,
            projectedCosts,
            overBy: Math.max(0, projectedCosts - budget.totalBudget),
            status: projected,
          }
        }
        if (projected === 'OVERAGE' && !body.confirmOverage) {
          return NextResponse.json(
            {
              error: 'Approving this invoice would push the project over budget',
              requiresConfirmation: true,
              overage,
            },
            { status: 409 },
          )
        }
      }
    }

    const updated = await prisma.invoiceSubmission.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: user.userId,
        approvedAt: new Date(),
        reviewedBy: invoice.reviewedBy ?? user.userId,
      },
    })

    return NextResponse.json({ invoice: updated, overage })
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
})
