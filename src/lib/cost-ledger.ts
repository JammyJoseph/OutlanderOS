// ===== Cost ledger — server-side helpers =====
//
// One ledger, many lenses. See the CostLine model in prisma/schema.prisma for
// the reasoning. These helpers exist so every lens (print issue, production,
// deal, finance) computes its numbers the same way.
//
// The central rule: BUDGET and ACTUAL are separate rows. "What did we spend?"
// is always a sum over ACTUAL rows — never a choice between two columns.

import prisma from '@/lib/prisma'

export type CostKind = 'BUDGET' | 'COMMITTED' | 'ACTUAL'

export interface LedgerTotals {
  budget: number
  committed: number
  actual: number
  variance: number // budget − actual (positive = under)
}

export function emptyTotals(): LedgerTotals {
  return { budget: 0, committed: 0, actual: 0, variance: 0 }
}

export function totalsFrom(rows: { kind: string; amount: number }[]): LedgerTotals {
  let budget = 0
  let committed = 0
  let actual = 0
  for (const r of rows) {
    const amt = r.amount || 0
    if (r.kind === 'BUDGET') budget += amt
    else if (r.kind === 'COMMITTED') committed += amt
    else if (r.kind === 'ACTUAL') actual += amt
  }
  return { budget, committed, actual, variance: budget - actual }
}

// ── Actuals for a set of budget lines ──────────────────────────────────────
//
// An ACTUAL row counts against a budget line in one of two ways:
//   1. It names the line directly (`budgetLineId`) — the precise case, used when
//      an invoice is coded against a specific budgeted item.
//   2. The budget line is linked to a Production, and the actual belongs to that
//      production without naming a line.
//
// These are added, not chosen between — case 2 excludes rows that already have a
// budgetLineId so nothing is counted twice.
export async function actualsForBudgetLines(
  lines: { id: string; productionId: string | null }[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (lines.length === 0) return out
  for (const l of lines) out.set(l.id, 0)

  // (1) Directly attributed actuals.
  const direct = await prisma.costLine.groupBy({
    by: ['budgetLineId'],
    where: { kind: 'ACTUAL', budgetLineId: { in: lines.map((l) => l.id) } },
    _sum: { amount: true },
  })
  for (const d of direct) {
    if (d.budgetLineId) out.set(d.budgetLineId, d._sum.amount ?? 0)
  }

  // (2) Production-attributed actuals not already tied to a specific line.
  //
  // Production budgets now live on this ledger too, so every actual — whether it
  // was entered on a production budget line or against a print budget row — is
  // an ACTUAL CostLine. The legacy bridge that used to read BudgetLineItem here
  // is gone with that table.
  const prodIds = [...new Set(lines.map((l) => l.productionId).filter((v): v is string => !!v))]
  if (prodIds.length > 0) {
    const byProd = await prisma.costLine.groupBy({
      by: ['productionId'],
      where: {
        kind: 'ACTUAL',
        productionId: { in: prodIds },
        // Anything already attributed to one of these budget lines was counted
        // in (1); counting it again here would double it.
        NOT: { budgetLineId: { in: lines.map((l) => l.id) } },
      },
      _sum: { amount: true },
    })
    const prodTotals = new Map(byProd.map((p) => [p.productionId!, p._sum.amount ?? 0]))

    for (const l of lines) {
      if (l.productionId && prodTotals.has(l.productionId)) {
        out.set(l.id, (out.get(l.id) ?? 0) + prodTotals.get(l.productionId)!)
      }
    }
  }

  return out
}

// ── Production budget lines ────────────────────────────────────────────────
//
// Production budgets used to be their own `BudgetLineItem` table, where each row
// carried a budgeted AND an actual figure. They are ledger rows now, but a lot of
// callers still want them in the old per-line shape, so these helpers render it:
// the BUDGET row's `amount` becomes `budgeted`, and `actual` is summed from the
// ACTUAL rows drawn against it.

export interface ProductionBudgetItem {
  id: string
  productionId: string
  category: string
  section: string | null
  role: string | null
  quantity: number | null
  rate: number | null
  vatPercent: number | null
  description: string
  budgeted: number
  actual: number
  notes: string | null
  invoiceStatus: string | null
  invoiceUrl: string | null
  poNumber: string | null
  invoicedAmount: number | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

const PRODUCTION_LINE_SELECT = {
  id: true,
  productionId: true,
  category: true,
  section: true,
  role: true,
  quantity: true,
  rate: true,
  vatPercent: true,
  description: true,
  amount: true,
  notes: true,
  invoiceStatus: true,
  invoiceUrl: true,
  poNumber: true,
  invoicedAmount: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const

// Budget lines for many productions at once, grouped by production id. One query
// for the lines and one for their actuals, regardless of how many productions —
// this replaces a nested `budgetItems` include, so callers must not loop.
export async function productionBudgetItemsFor(
  productionIds: string[]
): Promise<Map<string, ProductionBudgetItem[]>> {
  const out = new Map<string, ProductionBudgetItem[]>()
  const ids = [...new Set(productionIds.filter(Boolean))]
  if (ids.length === 0) return out

  const rows = await prisma.costLine.findMany({
    where: { productionId: { in: ids }, kind: 'BUDGET' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: PRODUCTION_LINE_SELECT,
  })
  if (rows.length === 0) return out

  const sums = await prisma.costLine.groupBy({
    by: ['budgetLineId'],
    where: { kind: 'ACTUAL', budgetLineId: { in: rows.map((r) => r.id) } },
    _sum: { amount: true },
  })
  const actuals = new Map<string, number>()
  for (const s of sums) if (s.budgetLineId) actuals.set(s.budgetLineId, s._sum.amount ?? 0)

  for (const r of rows) {
    const item: ProductionBudgetItem = {
      id: r.id,
      productionId: r.productionId ?? '',
      category: r.category ?? 'other',
      section: r.section,
      role: r.role,
      quantity: r.quantity,
      rate: r.rate,
      vatPercent: r.vatPercent,
      description: r.description,
      budgeted: r.amount,
      actual: actuals.get(r.id) ?? 0,
      notes: r.notes,
      invoiceStatus: r.invoiceStatus,
      invoiceUrl: r.invoiceUrl,
      poNumber: r.poNumber,
      invoicedAmount: r.invoicedAmount,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
    const list = out.get(item.productionId)
    if (list) list.push(item)
    else out.set(item.productionId, [item])
  }
  return out
}

export async function productionBudgetItems(productionId: string): Promise<ProductionBudgetItem[]> {
  return (await productionBudgetItemsFor([productionId])).get(productionId) ?? []
}

// Total ACTUAL spend per production, for callers that only need the number.
export async function productionActualsByProduction(
  productionIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const ids = [...new Set(productionIds.filter(Boolean))]
  if (ids.length === 0) return out
  const sums = await prisma.costLine.groupBy({
    by: ['productionId'],
    where: { kind: 'ACTUAL', productionId: { in: ids } },
    _sum: { amount: true },
  })
  for (const s of sums) if (s.productionId) out.set(s.productionId, s._sum.amount ?? 0)
  return out
}

// ── Whole-issue / whole-project rollups ────────────────────────────────────

export async function totalsForIssue(magazinePlanId: string): Promise<LedgerTotals> {
  const rows = await prisma.costLine.groupBy({
    by: ['kind'],
    where: { magazinePlanId },
    _sum: { amount: true },
  })
  return totalsFrom(rows.map((r) => ({ kind: r.kind, amount: r._sum.amount ?? 0 })))
}

export async function totalsForProduction(productionId: string): Promise<LedgerTotals> {
  const rows = await prisma.costLine.groupBy({
    by: ['kind'],
    where: { productionId },
    _sum: { amount: true },
  })
  return totalsFrom(rows.map((r) => ({ kind: r.kind, amount: r._sum.amount ?? 0 })))
}

// Finance's lens: the same ledger with no context filter, grouped by coding.
// Uncoded rows collect under a null accountCode so they're visible rather than
// silently dropped — an uncoded cost is a job to do, not a row to hide.
export async function totalsByAccount(): Promise<
  { accountCode: string | null; accountName: string | null; totals: LedgerTotals }[]
> {
  const rows = await prisma.costLine.groupBy({
    by: ['accountCode', 'accountName', 'kind'],
    _sum: { amount: true },
  })
  const byAccount = new Map<string, { accountCode: string | null; accountName: string | null; rows: { kind: string; amount: number }[] }>()
  for (const r of rows) {
    const key = r.accountCode ?? '__uncoded__'
    if (!byAccount.has(key)) {
      byAccount.set(key, { accountCode: r.accountCode, accountName: r.accountName, rows: [] })
    }
    byAccount.get(key)!.rows.push({ kind: r.kind, amount: r._sum.amount ?? 0 })
  }
  return [...byAccount.values()].map((a) => ({
    accountCode: a.accountCode,
    accountName: a.accountName,
    totals: totalsFrom(a.rows),
  }))
}
