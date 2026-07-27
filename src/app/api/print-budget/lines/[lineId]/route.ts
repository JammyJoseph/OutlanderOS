import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { isPrintBudgetSection } from '@/lib/print-budget'

// Live actual for a production (see the collection route for the rationale).
type ProdWithItems = { id: string; title: string; budgetActual: number | null; budgetItems: { actual: number }[] }
function productionActual(p: ProdWithItems): number {
  const fromItems = p.budgetItems.reduce((s, i) => s + (i.actual ?? 0), 0)
  return fromItems > 0 ? fromItems : p.budgetActual ?? 0
}

// PUT /api/print-budget/lines/[lineId]
// Partial update of a single budget line (auto-save on blur writes one field at
// a time). Only supplied fields are touched.
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
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
    // actual: null clears the manual figure; a number sets it.
    if (body.actual !== undefined) data.actual = body.actual === null ? null : Number(body.actual)
    if (body.notes !== undefined) data.notes = body.notes || null
    // productionId: '' / null unlinks; a string links (and the live actual takes over).
    if (body.productionId !== undefined) data.productionId = body.productionId || null
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const line = await prisma.printBudgetLine.update({ where: { id: lineId }, data })

    let productionActualValue: number | null = null
    let productionTitle: string | null = null
    if (line.productionId) {
      const prod = await prisma.production.findUnique({
        where: { id: line.productionId },
        select: { id: true, title: true, budgetActual: true, budgetItems: { select: { actual: true } } },
      })
      if (prod) {
        productionActualValue = productionActual(prod)
        productionTitle = prod.title
      }
    }

    return NextResponse.json({
      line: {
        id: line.id,
        section: line.section,
        description: line.description,
        amount: line.amount,
        actual: line.actual,
        notes: line.notes,
        productionId: line.productionId,
        productionActual: productionActualValue,
        productionTitle,
        sortOrder: line.sortOrder,
      },
    })
  } catch (err) {
    console.error('PUT /api/print-budget/lines/[lineId]', err)
    return NextResponse.json({ error: 'Failed to update line' }, { status: 500 })
  }
})

// DELETE /api/print-budget/lines/[lineId]
export const DELETE = withAuth(async (
  _request: NextRequest,
  { params }: { params?: Promise<Record<string, string>> },
) => {
  const { lineId } = (await params)!
  try {
    await prisma.printBudgetLine.delete({ where: { id: lineId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/print-budget/lines/[lineId]', err)
    return NextResponse.json({ error: 'Failed to delete line' }, { status: 500 })
  }
})
