import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// List cost entries, filterable by campaignBudgetId, category, or portal.
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const params = request.nextUrl.searchParams
    const campaignBudgetId = params.get('campaignBudgetId') || undefined
    const category = params.get('category') || undefined
    const portal = params.get('portal') || undefined
    const entries = await prisma.costEntry.findMany({
      where: {
        ...(campaignBudgetId ? { campaignBudgetId } : {}),
        ...(category ? { category } : {}),
        ...(portal ? { portal } : {}),
      },
      orderBy: { date: 'desc' },
    })
    const total = entries.reduce((s, e) => s + e.amount, 0)
    return NextResponse.json({ entries, total, count: entries.length })
  } catch (e) {
    return NextResponse.json({ entries: [], total: 0, count: 0, error: String(e) }, { status: 500 })
  }
})

// Log a new cost.
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  try {
    const body = await request.json()
    if (!body.description || body.amount === undefined) {
      return NextResponse.json({ error: 'description and amount are required' }, { status: 400 })
    }
    const entry = await prisma.costEntry.create({
      data: {
        campaignBudgetId: body.campaignBudgetId ?? null,
        category: body.category || 'other',
        description: body.description,
        amount: Number(body.amount) || 0,
        vendor: body.vendor ?? null,
        date: body.date ? new Date(body.date) : new Date(),
        receipt: body.receipt ?? null,
        loggedBy: user.userId,
        portal: body.portal ?? null,
        status: body.status || 'LOGGED',
        xeroMatchId: body.xeroMatchId ?? null,
      },
    })
    return NextResponse.json({ entry }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
})
