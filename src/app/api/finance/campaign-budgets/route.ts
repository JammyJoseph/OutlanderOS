import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// List all campaign budgets, optionally filtered by status or trello card.
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const params = request.nextUrl.searchParams
    const status = params.get('status') || undefined
    const trelloCardId = params.get('trelloCardId') || undefined
    const budgets = await prisma.campaignBudget.findMany({
      where: { ...(status ? { status } : {}), ...(trelloCardId ? { trelloCardId } : {}) },
      orderBy: { updatedAt: 'desc' },
    })
    const totalBudget = budgets.reduce((s, b) => s + b.totalBudget, 0)
    return NextResponse.json({ budgets, totalBudget, count: budgets.length })
  } catch (e) {
    return NextResponse.json({ budgets: [], totalBudget: 0, count: 0, error: String(e) }, { status: 500 })
  }
})

// Create or submit a campaign budget.
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  try {
    const body = await request.json()
    if (!body.clientName || !body.campaignName) {
      return NextResponse.json({ error: 'clientName and campaignName are required' }, { status: 400 })
    }
    const status = body.status === 'SUBMITTED' ? 'SUBMITTED' : body.status || 'DRAFT'
    const budget = await prisma.campaignBudget.create({
      data: {
        trelloCardId: body.trelloCardId ?? null,
        trelloCardName: body.trelloCardName ?? null,
        clientName: body.clientName,
        campaignName: body.campaignName,
        totalBudget: Number(body.totalBudget) || 0,
        productionBudget: Number(body.productionBudget) || 0,
        mediaBudget: Number(body.mediaBudget) || 0,
        internalBudget: Number(body.internalBudget) || 0,
        otherBudget: Number(body.otherBudget) || 0,
        status,
        submittedBy: status === 'SUBMITTED' ? user.userId : body.submittedBy ?? null,
        notes: body.notes ?? null,
        productionId: body.productionId ?? null,
      },
    })
    return NextResponse.json({ budget }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
})
