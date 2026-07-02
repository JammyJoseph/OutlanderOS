import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminDb } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const NUMERIC_FIELDS = [
  'totalBudget',
  'productionBudget',
  'mediaBudget',
  'internalBudget',
  'otherBudget',
] as const

// Update or approve a campaign budget. Setting status=APPROVED stamps approvedBy.
export const PUT = withAdminDb(async (request: NextRequest, context, user) => {
  try {
    const params = context.params ? await context.params : {}
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const existing = await prisma.campaignBudget.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await request.json()
    const data: Record<string, unknown> = {}

    for (const field of NUMERIC_FIELDS) {
      if (body[field] !== undefined) data[field] = Number(body[field]) || 0
    }
    for (const field of ['clientName', 'campaignName', 'trelloCardId', 'trelloCardName', 'notes', 'productionId']) {
      if (body[field] !== undefined) data[field] = body[field]
    }

    if (body.status !== undefined) {
      data.status = body.status
      if (body.status === 'APPROVED' && !existing.approvedBy) data.approvedBy = user.userId
      if (body.status === 'SUBMITTED' && !existing.submittedBy) data.submittedBy = user.userId
    }

    const budget = await prisma.campaignBudget.update({ where: { id }, data })
    return NextResponse.json({ budget })
  } catch (e) {
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
})
