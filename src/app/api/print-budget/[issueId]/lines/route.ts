import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { type MagazinePage } from '@/lib/magazine-plan'
import {
  MAGAZINE_PRODUCTION_TEMPLATE,
  isPrintBudgetSection,
  type PrintBudgetSection,
} from '@/lib/print-budget'

// Live actual for a production: sum of its budget line-item actuals, falling back
// to the stored budgetActual when no line items have been costed. Mirrors the
// existing print-budget GET route's productionActual().
type ProdWithItems = { id: string; title: string; budgetActual: number | null; budgetItems: { actual: number }[] }
function productionActual(p: ProdWithItems): number {
  const fromItems = p.budgetItems.reduce((s, i) => s + (i.actual ?? 0), 0)
  return fromItems > 0 ? fromItems : p.budgetActual ?? 0
}

// Serialises a stored line to the API shape, resolving the linked production's
// live actual + title from the supplied production map.
function serialise(
  line: {
    id: string
    section: string
    description: string
    amount: number
    actual: number | null
    notes: string | null
    productionId: string | null
    sortOrder: number
  },
  prodMap: Map<string, ProdWithItems>,
) {
  const prod = line.productionId ? prodMap.get(line.productionId) : null
  return {
    id: line.id,
    section: line.section,
    description: line.description,
    amount: line.amount,
    actual: line.actual,
    notes: line.notes,
    productionId: line.productionId,
    productionActual: prod ? productionActual(prod) : null,
    productionTitle: prod ? prod.title : null,
    sortOrder: line.sortOrder,
  }
}

// Loads every production referenced by the given lines so their live actuals can
// be resolved in one query.
async function loadProductions(productionIds: string[]): Promise<Map<string, ProdWithItems>> {
  const ids = [...new Set(productionIds.filter(Boolean))]
  if (ids.length === 0) return new Map()
  const prods = await prisma.production.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, budgetActual: true, budgetItems: { select: { actual: true } } },
  })
  return new Map(prods.map((p) => [p.id, p]))
}

// GET /api/print-budget/[issueId]/lines
// Returns the issue's section-based budget lines (with live production actuals),
// the issue revenue, the active productions available for linking, and the flat
// plan's produced features so the Productions section can be auto-synced.
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

    const lines = await prisma.printBudgetLine.findMany({
      where: { magazinePlanId: issueId },
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
    })

    const prodMap = await loadProductions(lines.map((l) => l.productionId).filter((id): id is string => !!id))

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

    // Active productions for the link pickers (archived hidden).
    const productions = await prisma.production.findMany({
      where: { archived: false },
      select: { id: true, title: true, clientName: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({
      issue: { id: plan.id, issueNumber: plan.issueNumber, issueName: plan.issueName, totalRevenue: plan.totalRevenue },
      lines: lines.map((l) => serialise(l, prodMap)),
      productions: productions.map((p) => ({ id: p.id, title: p.title, client: p.clientName })),
      flatPlanLinks,
    })
  } catch (err) {
    console.error('GET /api/print-budget/[issueId]/lines', err)
    return NextResponse.json({ error: 'Failed to load print budget' }, { status: 500 })
  }
})

// POST /api/print-budget/[issueId]/lines
// Supports four shapes:
//   { action: 'template' }         → seed the standard Magazine Production items
//   { action: 'syncProductions' }  → upsert a Productions line per linked feature
//   { lines: [...] }               → bulk create
//   { section, description, ... }  → create a single line
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
) => {
  const { issueId } = (await params)!
  try {
    const plan = await prisma.magazinePlan.findUnique({
      where: { id: issueId },
      select: { id: true, pages: true },
    })
    if (!plan) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))

    // Next sortOrder within a section = max existing + 1.
    const nextSortOrder = async (section: string, offset = 0) => {
      const last = await prisma.printBudgetLine.findFirst({
        where: { magazinePlanId: issueId, section },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
      return (last?.sortOrder ?? -1) + 1 + offset
    }

    // ── Template: seed Magazine Production, skipping any already present ──
    if (body.action === 'template') {
      const existing = await prisma.printBudgetLine.findMany({
        where: { magazinePlanId: issueId, section: 'MAGAZINE_PRODUCTION' },
        select: { description: true },
      })
      const have = new Set(existing.map((e) => e.description.trim().toLowerCase()))
      const toCreate = MAGAZINE_PRODUCTION_TEMPLATE.filter((t) => !have.has(t.description.trim().toLowerCase()))
      if (toCreate.length === 0) {
        return NextResponse.json({ created: 0, message: 'Template already applied' })
      }
      const base = await nextSortOrder('MAGAZINE_PRODUCTION')
      await prisma.printBudgetLine.createMany({
        data: toCreate.map((t, i) => ({
          magazinePlanId: issueId,
          section: 'MAGAZINE_PRODUCTION',
          description: t.description,
          amount: t.amount,
          sortOrder: base + i,
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
      const existing = await prisma.printBudgetLine.findMany({
        where: { magazinePlanId: issueId, section: 'PRODUCTIONS', productionId: { in: linkIds } },
        select: { productionId: true },
      })
      const have = new Set(existing.map((e) => e.productionId))
      const missing = prods.filter((p) => !have.has(p.id))
      if (missing.length === 0) return NextResponse.json({ created: 0, message: 'Productions already in sync' })

      const base = await nextSortOrder('PRODUCTIONS')
      await prisma.printBudgetLine.createMany({
        data: missing.map((p, i) => ({
          magazinePlanId: issueId,
          section: 'PRODUCTIONS',
          description: p.title,
          amount: 0,
          productionId: p.id,
          sortOrder: base + i,
        })),
      })
      return NextResponse.json({ created: missing.length })
    }

    // ── Bulk create ──
    if (Array.isArray(body.lines)) {
      const valid = body.lines.filter((l: { section?: string }) => l.section && isPrintBudgetSection(l.section))
      if (valid.length === 0) return NextResponse.json({ error: 'No valid lines' }, { status: 400 })
      // Assign incrementing sortOrders per section, starting after the current max.
      const bases = new Map<string, number>()
      const data = [] as {
        magazinePlanId: string
        section: string
        description: string
        amount: number
        actual: number | null
        notes: string | null
        productionId: string | null
        sortOrder: number
      }[]
      for (const l of valid as {
        section: PrintBudgetSection
        description?: string
        amount?: number
        actual?: number | null
        notes?: string | null
        productionId?: string | null
      }[]) {
        if (!bases.has(l.section)) bases.set(l.section, await nextSortOrder(l.section))
        const so = bases.get(l.section)!
        bases.set(l.section, so + 1)
        data.push({
          magazinePlanId: issueId,
          section: l.section,
          description: (l.description ?? '').trim(),
          amount: l.amount ?? 0,
          actual: l.actual ?? null,
          notes: l.notes || null,
          productionId: l.productionId || null,
          sortOrder: so,
        })
      }
      await prisma.printBudgetLine.createMany({ data })
      return NextResponse.json({ created: data.length })
    }

    // ── Single create ──
    const section = body.section as string | undefined
    if (!section || !isPrintBudgetSection(section)) {
      return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
    }
    const line = await prisma.printBudgetLine.create({
      data: {
        magazinePlanId: issueId,
        section,
        description: (body.description ?? '').trim(),
        amount: typeof body.amount === 'number' ? body.amount : 0,
        actual: typeof body.actual === 'number' ? body.actual : null,
        notes: body.notes || null,
        productionId: body.productionId || null,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : await nextSortOrder(section),
      },
    })
    const prodMap = await loadProductions([line.productionId].filter((id): id is string => !!id))
    return NextResponse.json({ line: serialise(line, prodMap) }, { status: 201 })
  } catch (err) {
    console.error('POST /api/print-budget/[issueId]/lines', err)
    return NextResponse.json({ error: 'Failed to save print budget line' }, { status: 500 })
  }
})
