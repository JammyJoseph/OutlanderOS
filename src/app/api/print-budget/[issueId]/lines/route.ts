import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { type MagazinePage } from '@/lib/magazine-plan'
import { actualsForBudgetLines } from '@/lib/cost-ledger'
import {
  MAGAZINE_PRODUCTION_TEMPLATE,
  isPrintBudgetSection,
  type PrintBudgetSection,
} from '@/lib/print-budget'

// The print budget is the cost ledger filtered to one issue. The rows shown here
// are the BUDGET rows; each one's `actual` is summed from ACTUAL rows on the same
// ledger (see lib/cost-ledger.ts). Nothing is copied or synced between the two.

type LedgerRow = {
  id: string
  section: string | null
  description: string
  amount: number
  notes: string | null
  productionId: string | null
  accountCode: string | null
  accountName: string | null
  sortOrder: number
  production?: { title: string } | null
}

const LINE_SELECT = {
  id: true,
  section: true,
  description: true,
  amount: true,
  notes: true,
  productionId: true,
  accountCode: true,
  accountName: true,
  sortOrder: true,
  production: { select: { title: true } },
} as const

async function serialiseLines(rows: LedgerRow[]) {
  const actuals = await actualsForBudgetLines(
    rows.map((r) => ({ id: r.id, productionId: r.productionId }))
  )
  return rows.map((r) => ({
    id: r.id,
    section: r.section ?? 'OTHER',
    description: r.description,
    amount: r.amount,
    actual: actuals.get(r.id) ?? 0,
    notes: r.notes,
    productionId: r.productionId,
    productionTitle: r.production?.title ?? null,
    accountCode: r.accountCode,
    accountName: r.accountName,
    sortOrder: r.sortOrder,
  }))
}

// GET /api/print-budget/[issueId]/lines
export const GET = withAuth(async (
  _request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
) => {
  const { issueId } = (await params)!
  try {
    const plan = await prisma.magazinePlan.findUnique({
      where: { id: issueId },
      select: { id: true, issueNumber: true, issueName: true, totalRevenue: true, pages: true },
    })
    if (!plan) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

    const rows = await prisma.costLine.findMany({
      where: { magazinePlanId: issueId, kind: 'BUDGET' },
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
      select: LINE_SELECT,
    })

    // Produced features on the flat plan that carry a productionId — the source
    // for the Productions section's auto-sync.
    const pages = (Array.isArray(plan.pages) ? plan.pages : []) as unknown as MagazinePage[]
    const seen = new Set<string>()
    const flatPlanLinks: { productionId: string; feature: string; photographer: string; shootDate: string }[] = []
    for (const pg of pages) {
      if (pg?.productionId && !seen.has(pg.productionId)) {
        seen.add(pg.productionId)
        flatPlanLinks.push({
          productionId: pg.productionId,
          feature: pg.feature || '',
          photographer: pg.photographer || '',
          shootDate: pg.shootDate || '',
        })
      }
    }

    const productions = await prisma.production.findMany({
      where: { archived: false },
      select: { id: true, title: true, clientName: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })

    // ── Issue revenue ──
    // Deal revenue is the sum of the DISTINCT campaigns linked on this issue's
    // flat plan. Distinct matters: a deal spanning a DPS appears on two pages
    // and must not be counted twice.
    //
    // `totalRevenue` on the plan is now "other income" — anything not coming
    // from a linked deal. The two are ADDED, never chosen between, so there's no
    // arbitration and no way for one to silently mask the other.
    const dealIds = [
      ...new Set(
        pages.map((pg) => pg?.campaignId).filter((v): v is string => typeof v === 'string' && !!v)
      ),
    ]
    const linkedDeals = dealIds.length
      ? await prisma.campaign.findMany({
          where: { id: { in: dealIds } },
          select: { id: true, title: true, dealValue: true, value: true, client: { select: { name: true } } },
        })
      : []
    const dealRevenue = linkedDeals.reduce((s, d) => s + (d.dealValue ?? d.value ?? 0), 0)
    const otherIncome = plan.totalRevenue ?? 0

    return NextResponse.json({
      issue: {
        id: plan.id,
        issueNumber: plan.issueNumber,
        issueName: plan.issueName,
        // Kept for the editable "other income" field the UI already binds to.
        totalRevenue: plan.totalRevenue,
        otherIncome,
        dealRevenue,
        revenue: dealRevenue + otherIncome,
        deals: linkedDeals.map((d) => ({
          id: d.id,
          title: d.title,
          client: d.client?.name ?? null,
          value: d.dealValue ?? d.value ?? 0,
        })),
      },
      lines: await serialiseLines(rows),
      productions: productions.map((p) => ({ id: p.id, title: p.title, client: p.clientName })),
      flatPlanLinks,
    })
  } catch (err) {
    console.error('GET /api/print-budget/[issueId]/lines', err)
    return NextResponse.json({ error: 'Failed to load print budget' }, { status: 500 })
  }
})

// POST /api/print-budget/[issueId]/lines
//   { action: 'template' }         → seed the standard Magazine Production items
//   { action: 'syncProductions' }  → upsert a Productions line per linked feature
//   { lines: [...] }               → bulk create
//   { section, description, ... }  → create a single line
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
  user,
) => {
  const { issueId } = (await params)!
  try {
    const plan = await prisma.magazinePlan.findUnique({
      where: { id: issueId },
      select: { id: true, pages: true },
    })
    if (!plan) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const author = { createdById: user.userId, createdByName: user.name }

    const nextSortOrder = async (section: string, offset = 0) => {
      const last = await prisma.costLine.findFirst({
        where: { magazinePlanId: issueId, kind: 'BUDGET', section },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
      return (last?.sortOrder ?? -1) + 1 + offset
    }

    // ── Template: seed Magazine Production, skipping any already present ──
    if (body.action === 'template') {
      const existing = await prisma.costLine.findMany({
        where: { magazinePlanId: issueId, kind: 'BUDGET', section: 'MAGAZINE_PRODUCTION' },
        select: { description: true },
      })
      const have = new Set(existing.map((e) => e.description.trim().toLowerCase()))
      const toCreate = MAGAZINE_PRODUCTION_TEMPLATE.filter((t) => !have.has(t.description.trim().toLowerCase()))
      if (toCreate.length === 0) {
        return NextResponse.json({ created: 0, message: 'Template already applied' })
      }
      const base = await nextSortOrder('MAGAZINE_PRODUCTION')
      await prisma.costLine.createMany({
        data: toCreate.map((t, i) => ({
          magazinePlanId: issueId,
          kind: 'BUDGET' as const,
          section: 'MAGAZINE_PRODUCTION',
          description: t.description,
          amount: t.amount,
          sortOrder: base + i,
          ...author,
        })),
      })
      return NextResponse.json({ created: toCreate.length })
    }

    // ── Sync productions: one Productions line per flat-plan-linked production ──
    if (body.action === 'syncProductions') {
      const pages = (Array.isArray(plan.pages) ? plan.pages : []) as unknown as MagazinePage[]
      const linkIds = [...new Set(pages.map((p) => p?.productionId).filter((id): id is string => !!id))]
      if (linkIds.length === 0) return NextResponse.json({ created: 0, message: 'No produced features linked on the flat plan' })

      const prods = await prisma.production.findMany({
        where: { id: { in: linkIds } },
        select: { id: true, title: true },
      })
      const existing = await prisma.costLine.findMany({
        where: { magazinePlanId: issueId, kind: 'BUDGET', section: 'PRODUCTIONS', productionId: { in: linkIds } },
        select: { productionId: true },
      })
      const have = new Set(existing.map((e) => e.productionId))
      const missing = prods.filter((p) => !have.has(p.id))
      if (missing.length === 0) return NextResponse.json({ created: 0, message: 'Productions already in sync' })

      const base = await nextSortOrder('PRODUCTIONS')
      await prisma.costLine.createMany({
        data: missing.map((p, i) => ({
          magazinePlanId: issueId,
          kind: 'BUDGET' as const,
          section: 'PRODUCTIONS',
          description: p.title,
          amount: 0,
          productionId: p.id,
          sortOrder: base + i,
          ...author,
        })),
      })
      return NextResponse.json({ created: missing.length })
    }

    // ── Bulk create ──
    if (Array.isArray(body.lines)) {
      const valid = body.lines.filter((l: { section?: string }) => l.section && isPrintBudgetSection(l.section))
      if (valid.length === 0) return NextResponse.json({ error: 'No valid lines' }, { status: 400 })
      const bases = new Map<string, number>()
      const data = []
      for (const l of valid as {
        section: PrintBudgetSection
        description?: string
        amount?: number
        notes?: string | null
        productionId?: string | null
      }[]) {
        if (!bases.has(l.section)) bases.set(l.section, await nextSortOrder(l.section))
        const so = bases.get(l.section)!
        bases.set(l.section, so + 1)
        data.push({
          magazinePlanId: issueId,
          kind: 'BUDGET' as const,
          section: l.section,
          description: (l.description ?? '').trim(),
          amount: l.amount ?? 0,
          notes: l.notes || null,
          productionId: l.productionId || null,
          sortOrder: so,
          ...author,
        })
      }
      await prisma.costLine.createMany({ data })
      return NextResponse.json({ created: data.length })
    }

    // ── Single create ──
    const section = body.section as string | undefined
    if (!section || !isPrintBudgetSection(section)) {
      return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
    }
    const created = await prisma.costLine.create({
      data: {
        magazinePlanId: issueId,
        kind: 'BUDGET',
        section,
        description: (body.description ?? '').trim(),
        amount: typeof body.amount === 'number' ? body.amount : 0,
        notes: body.notes || null,
        productionId: body.productionId || null,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : await nextSortOrder(section),
        ...author,
      },
      select: LINE_SELECT,
    })
    const [line] = await serialiseLines([created])
    return NextResponse.json({ line }, { status: 201 })
  } catch (err) {
    console.error('POST /api/print-budget/[issueId]/lines', err)
    return NextResponse.json({ error: 'Failed to save print budget line' }, { status: 500 })
  }
})
