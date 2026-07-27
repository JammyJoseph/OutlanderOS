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
  const prodIds = [...new Set(lines.map((l) => l.productionId).filter((v): v is string => !!v))]
  if (prodIds.length > 0) {
    const byProd = await prisma.costLine.groupBy({
      by: ['productionId'],
      where: { kind: 'ACTUAL', productionId: { in: prodIds }, budgetLineId: null },
      _sum: { amount: true },
    })
    const prodTotals = new Map(byProd.map((p) => [p.productionId!, p._sum.amount ?? 0]))

    // Legacy bridge — production actuals still live in BudgetLineItem until the
    // production budget tab moves onto the ledger. Delete this block with that
    // migration; until then a linked production's spend would read as zero.
    const legacy = await prisma.production.findMany({
      where: { id: { in: prodIds } },
      select: { id: true, budgetActual: true, budgetItems: { select: { actual: true } } },
    })
    for (const p of legacy) {
      const fromItems = p.budgetItems.reduce((s, i) => s + (i.actual ?? 0), 0)
      const legacyActual = fromItems > 0 ? fromItems : p.budgetActual ?? 0
      prodTotals.set(p.id, (prodTotals.get(p.id) ?? 0) + legacyActual)
    }

    for (const l of lines) {
      if (l.productionId && prodTotals.has(l.productionId)) {
        out.set(l.id, (out.get(l.id) ?? 0) + prodTotals.get(l.productionId)!)
      }
    }
  }

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
