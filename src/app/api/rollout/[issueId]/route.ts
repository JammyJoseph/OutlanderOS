import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

// Typed rather than inferred: without the annotation TypeScript widens 'asc' to
// string and Prisma rejects the whole include.
const INCLUDE: Prisma.RolloutPlanInclude = {
  covers: { orderBy: { sortOrder: 'asc' } },
  profiles: { orderBy: { sortOrder: 'asc' } },
  hubs: { orderBy: { sortOrder: 'asc' } },
  channels: { orderBy: { sortOrder: 'asc' } },
  territories: { orderBy: { sortOrder: 'asc' } },
  stockists: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
  events: { orderBy: { sortOrder: 'asc' } },
  lanes: { orderBy: { sortOrder: 'asc' } },
  milestones: { orderBy: [{ seq: 'asc' }] },
}

// GET /api/rollout/[issueId]
//
// Returns the plan and its rows. Everything derived — cover splits, hub totals,
// reconciliation — is computed client-side from this payload by lib/rollout.ts,
// so there is exactly one implementation of each formula rather than one on each
// side of the wire.
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
) => {
  const { issueId } = (await params)!
  try {
    const issue = await prisma.magazinePlan.findUnique({
      where: { id: issueId },
      select: { id: true, issueNumber: true, issueName: true },
    })
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

    const plan = await prisma.rolloutPlan.findUnique({
      where: { magazinePlanId: issueId },
      include: INCLUDE,
    })

    return NextResponse.json({ issue, plan })
  } catch (err) {
    console.error('GET /api/rollout/[issueId]', err)
    return NextResponse.json({ error: 'Failed to load rollout plan' }, { status: 500 })
  }
})

// POST /api/rollout/[issueId] — create the plan for an issue that has none.
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
) => {
  const { issueId } = (await params)!
  try {
    const issue = await prisma.magazinePlan.findUnique({ where: { id: issueId } })
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

    const existing = await prisma.rolloutPlan.findUnique({ where: { magazinePlanId: issueId } })
    if (existing) {
      return NextResponse.json({ error: 'This issue already has a rollout plan.' }, { status: 409 })
    }

    const body = await request.json().catch(() => ({}))
    const plan = await prisma.rolloutPlan.create({
      data: {
        magazinePlanId: issueId,
        totalPrintRun: Number(body.totalPrintRun) || 0,
      },
      include: INCLUDE,
    })
    return NextResponse.json({ plan }, { status: 201 })
  } catch (err) {
    console.error('POST /api/rollout/[issueId]', err)
    return NextResponse.json({ error: 'Failed to create rollout plan' }, { status: 500 })
  }
})

// PATCH /api/rollout/[issueId] — plan-level inputs only.
export const PATCH = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
) => {
  const { issueId } = (await params)!
  try {
    const body = await request.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body.totalPrintRun !== undefined) data.totalPrintRun = Number(body.totalPrintRun) || 0
    if (body.gbpToUsd !== undefined) data.gbpToUsd = Number(body.gbpToUsd) || 0
    if (body.eastCoastShare !== undefined) data.eastCoastShare = Number(body.eastCoastShare) || 0
    if (body.assumptions !== undefined) data.assumptions = body.assumptions || null
    if (body.launchDate !== undefined) {
      data.launchDate = body.launchDate ? new Date(String(body.launchDate)) : null
    }
    if (body.warehouseDeadline !== undefined) {
      data.warehouseDeadline = body.warehouseDeadline ? new Date(String(body.warehouseDeadline)) : null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const plan = await prisma.rolloutPlan.update({
      where: { magazinePlanId: issueId },
      data,
      include: INCLUDE,
    })
    return NextResponse.json({ plan })
  } catch (err) {
    console.error('PATCH /api/rollout/[issueId]', err)
    return NextResponse.json({ error: 'Failed to update rollout plan' }, { status: 500 })
  }
})
