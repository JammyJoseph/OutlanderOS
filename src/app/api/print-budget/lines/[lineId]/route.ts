import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { isPrintBudgetSection } from '@/lib/print-budget'
import { actualsForBudgetLines } from '@/lib/cost-ledger'

// Description used for the single ACTUAL row that backs a manually-typed actual.
// Typing a figure into the Actual column is a claim that money was spent, so it
// becomes a real ledger row rather than a second column on the budget row. When
// an invoice is later coded against the same budget line it adds another ACTUAL
// row and the two sum — which is why this one is identifiable and replaceable.
const MANUAL_ACTUAL = 'Recorded actual (manual entry)'

async function serialise(lineId: string) {
  const row = await prisma.costLine.findUnique({
    where: { id: lineId },
    select: {
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
    },
  })
  if (!row) return null
  const actuals = await actualsForBudgetLines([{ id: row.id, productionId: row.productionId }])
  return {
    id: row.id,
    section: row.section ?? 'OTHER',
    description: row.description,
    amount: row.amount,
    actual: actuals.get(row.id) ?? 0,
    notes: row.notes,
    productionId: row.productionId,
    productionTitle: row.production?.title ?? null,
    accountCode: row.accountCode,
    accountName: row.accountName,
    sortOrder: row.sortOrder,
  }
}

// PUT /api/print-budget/lines/[lineId]
// Partial update of a single budget line (auto-save on blur writes one field at
// a time). Only supplied fields are touched.
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
  user,
) => {
  const { lineId } = (await params)!
  try {
    const body = await request.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body.section !== undefined) {
      if (!isPrintBudgetSection(body.section)) {
        return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
      }
      data.section = body.section
    }
    if (body.description !== undefined) data.description = String(body.description).trim()
    if (body.amount !== undefined) data.amount = Number(body.amount) || 0
    if (body.notes !== undefined) data.notes = body.notes || null
    if (body.productionId !== undefined) data.productionId = body.productionId || null
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0
    if (body.accountCode !== undefined) data.accountCode = body.accountCode || null
    if (body.accountName !== undefined) data.accountName = body.accountName || null

    const existing = await prisma.costLine.findUnique({
      where: { id: lineId },
      select: { id: true, magazinePlanId: true, section: true, kind: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.kind !== 'BUDGET') {
      return NextResponse.json({ error: 'Only budget lines are editable here' }, { status: 400 })
    }

    if (Object.keys(data).length > 0) {
      await prisma.costLine.update({ where: { id: lineId }, data })
    }

    // ── A typed actual becomes an ACTUAL ledger row ──
    if (body.actual !== undefined) {
      const manual = await prisma.costLine.findFirst({
        where: { kind: 'ACTUAL', budgetLineId: lineId, description: MANUAL_ACTUAL },
        select: { id: true },
      })
      const value = body.actual === null ? null : Number(body.actual)

      if (value === null || Number.isNaN(value) || value === 0) {
        if (manual) await prisma.costLine.delete({ where: { id: manual.id } })
      } else if (manual) {
        await prisma.costLine.update({ where: { id: manual.id }, data: { amount: value } })
      } else {
        await prisma.costLine.create({
          data: {
            kind: 'ACTUAL',
            description: MANUAL_ACTUAL,
            amount: value,
            budgetLineId: lineId,
            magazinePlanId: existing.magazinePlanId,
            section: existing.section,
            createdById: user.userId,
            createdByName: user.name,
          },
        })
      }
    }

    const line = await serialise(lineId)
    if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ line })
  } catch (err) {
    console.error('PUT /api/print-budget/lines/[lineId]', err)
    return NextResponse.json({ error: 'Failed to update line' }, { status: 500 })
  }
})

// DELETE /api/print-budget/lines/[lineId]
// Removes the budget row and any actuals recorded against it. Actuals that were
// only ever attributed to this line have nowhere else to belong; leaving them
// would orphan spend that no longer appears in any budget.
export const DELETE = withAuth(async (
  _request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
) => {
  const { lineId } = (await params)!
  try {
    await prisma.costLine.deleteMany({ where: { budgetLineId: lineId } })
    await prisma.costLine.delete({ where: { id: lineId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/print-budget/lines/[lineId]', err)
    return NextResponse.json({ error: 'Failed to delete line' }, { status: 500 })
  }
})
