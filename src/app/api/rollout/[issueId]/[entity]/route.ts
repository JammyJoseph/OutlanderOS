import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import {
  isRolloutEntity,
  coerceBody,
  withCreateDefaults,
  delegateFor,
} from '@/lib/rollout-entities'

// POST /api/rollout/[issueId]/[entity] — add a row to one of the plan's
// collections. `entity` is validated against a closed allow-list before it goes
// anywhere near Prisma.
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
) => {
  const { issueId, entity } = (await params)!
  try {
    if (!isRolloutEntity(entity)) {
      return NextResponse.json({ error: `Unknown collection: ${entity}` }, { status: 400 })
    }
    const plan = await prisma.rolloutPlan.findUnique({
      where: { magazinePlanId: issueId },
      select: { id: true },
    })
    if (!plan) return NextResponse.json({ error: 'Rollout plan not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const data = withCreateDefaults(entity, coerceBody(entity, body))

    // New rows land at the end unless the caller said otherwise.
    if (data.sortOrder == null && entity !== 'milestones') {
      const last = await delegateFor(entity).findFirst({
        where: { planId: plan.id },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
      data.sortOrder = (last?.sortOrder ?? -1) + 1
    }
    if (entity === 'milestones' && !data.seq) {
      const last = await prisma.rolloutMilestone.findFirst({
        where: { planId: plan.id },
        orderBy: { seq: 'desc' },
        select: { seq: true },
      })
      data.seq = (last?.seq ?? 0) + 1
    }

    const row = await delegateFor(entity).create({ data: { ...data, planId: plan.id } })
    return NextResponse.json({ row }, { status: 201 })
  } catch (err) {
    console.error(`POST /api/rollout/[issueId]/${entity}`, err)
    return NextResponse.json({ error: 'Failed to add row' }, { status: 500 })
  }
})

// PUT /api/rollout/[issueId]/[entity]?rowId=… — partial update of one row.
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
) => {
  const { issueId, entity } = (await params)!
  try {
    if (!isRolloutEntity(entity)) {
      return NextResponse.json({ error: `Unknown collection: ${entity}` }, { status: 400 })
    }
    const rowId = new URL(request.url).searchParams.get('rowId')
    if (!rowId) return NextResponse.json({ error: 'rowId required' }, { status: 400 })

    const plan = await prisma.rolloutPlan.findUnique({
      where: { magazinePlanId: issueId },
      select: { id: true },
    })
    if (!plan) return NextResponse.json({ error: 'Rollout plan not found' }, { status: 404 })

    const data = coerceBody(entity, await request.json().catch(() => ({})))
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    // planId is in the `where`, so a row id belonging to another issue's plan
    // matches nothing rather than being edited across plans.
    const result = await delegateFor(entity).updateMany({
      where: { id: rowId, planId: plan.id },
      data,
    })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const row = await delegateFor(entity).findUnique({ where: { id: rowId } })
    return NextResponse.json({ row })
  } catch (err) {
    console.error(`PUT /api/rollout/[issueId]/${entity}`, err)
    return NextResponse.json({ error: 'Failed to update row' }, { status: 500 })
  }
})

// DELETE /api/rollout/[issueId]/[entity]?rowId=…
export const DELETE = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
) => {
  const { issueId, entity } = (await params)!
  try {
    if (!isRolloutEntity(entity)) {
      return NextResponse.json({ error: `Unknown collection: ${entity}` }, { status: 400 })
    }
    const rowId = new URL(request.url).searchParams.get('rowId')
    if (!rowId) return NextResponse.json({ error: 'rowId required' }, { status: 400 })

    const plan = await prisma.rolloutPlan.findUnique({
      where: { magazinePlanId: issueId },
      select: { id: true },
    })
    if (!plan) return NextResponse.json({ error: 'Rollout plan not found' }, { status: 404 })

    const result = await delegateFor(entity).deleteMany({ where: { id: rowId, planId: plan.id } })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`DELETE /api/rollout/[issueId]/${entity}`, err)
    return NextResponse.json({ error: 'Failed to delete row' }, { status: 500 })
  }
})
