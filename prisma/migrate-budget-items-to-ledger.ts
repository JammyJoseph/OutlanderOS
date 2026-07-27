/**
 * Migrates BudgetLineItem into the CostLine ledger.
 *
 * Run:  DATABASE_URL=... npx tsx prisma/migrate-budget-items-to-ledger.ts [--apply]
 *
 * Each BudgetLineItem holds a budget AND an actual in one record — exactly the
 * two-columns-one-row shape the ledger exists to remove. So each row becomes:
 *
 *   • one BUDGET CostLine carrying every descriptive field, and
 *   • where actual > 0, one ACTUAL CostLine drawn against it (budgetLineId).
 *
 * After this runs, production actuals live in the ledger and the legacy bridge in
 * lib/cost-ledger.ts can be deleted.
 *
 * Idempotent: rows already migrated are identified by a marker in `notes` and
 * skipped, so a re-run is a no-op. Verifies totals before and after and refuses
 * to report success on a mismatch.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const APPLY = process.argv.includes('--apply')
// Written as `${MARKER_PREFIX}<originalId>]`. The lookup must use this exact
// prefix — searching for a closed "[migrated:budgetLineItem]" matches nothing,
// which silently defeats the idempotency check and duplicates every row.
const MARKER_PREFIX = '[migrated:budgetLineItem:'
const ACTUAL_DESC = 'Recorded actual (migrated from production budget)'

const round2 = (n: number) => Math.round(n * 100) / 100

async function main() {
  console.log(APPLY ? 'MODE: APPLY\n' : 'MODE: DRY RUN (pass --apply to write)\n')

  const items = await prisma.budgetLineItem.findMany({
    orderBy: [{ productionId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  console.log(`BudgetLineItem rows: ${items.length}`)

  const srcBudget = round2(items.reduce((s, i) => s + (i.budgeted || 0), 0))
  const srcActual = round2(items.reduce((s, i) => s + (i.actual || 0), 0))
  const withActual = items.filter((i) => (i.actual || 0) > 0).length
  console.log(`  budgeted total: £${srcBudget.toLocaleString()}`)
  console.log(`  actual total:   £${srcActual.toLocaleString()}  (${withActual} rows carry an actual)`)

  // Already-migrated rows, so a re-run doesn't double up.
  const already = await prisma.costLine.findMany({
    where: { kind: 'BUDGET', notes: { contains: MARKER_PREFIX } },
    select: { notes: true },
  })
  const migratedIds = new Set(
    already
      .map((r) => r.notes?.match(/\[migrated:budgetLineItem:([^\]]+)\]/)?.[1])
      .filter((v): v is string => !!v)
  )
  if (migratedIds.size > 0) {
    console.log(`  already migrated: ${migratedIds.size} (will be skipped)`)
  }

  const todo = items.filter((i) => !migratedIds.has(i.id))
  console.log(`\nTo migrate: ${todo.length} budget rows, ${todo.filter((i) => (i.actual || 0) > 0).length} actual rows`)

  if (!APPLY) {
    console.log('\nDry run — nothing written.')
    return
  }

  let budgetRows = 0
  let actualRows = 0

  for (const item of todo) {
    // Preserve the original note text; append an identity marker so re-runs skip
    // this row and so the provenance of every migrated line stays visible.
    const notes = [item.notes, `${MARKER_PREFIX}${item.id}]`].filter(Boolean).join(' ')

    const budget = await prisma.costLine.create({
      data: {
        kind: 'BUDGET',
        productionId: item.productionId,
        description: item.description || item.role || item.category || 'Untitled line',
        amount: item.budgeted || 0,
        section: item.section,
        category: item.category,
        role: item.role,
        quantity: item.quantity,
        rate: item.rate,
        vatPercent: item.vatPercent,
        invoiceStatus: item.invoiceStatus,
        invoiceUrl: item.invoiceUrl,
        poNumber: item.poNumber,
        invoicedAmount: item.invoicedAmount,
        notes,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt,
        createdByName: 'BudgetLineItem migration',
      },
    })
    budgetRows++

    if ((item.actual || 0) > 0) {
      await prisma.costLine.create({
        data: {
          kind: 'ACTUAL',
          productionId: item.productionId,
          description: ACTUAL_DESC,
          amount: item.actual,
          section: item.section,
          category: item.category,
          budgetLineId: budget.id,
          invoiceStatus: item.invoiceStatus,
          invoiceUrl: item.invoiceUrl,
          poNumber: item.poNumber,
          createdAt: item.createdAt,
          createdByName: 'BudgetLineItem migration',
        },
      })
      actualRows++
    }
  }

  console.log(`\nCreated ${budgetRows} BUDGET rows and ${actualRows} ACTUAL rows.`)

  // ── Verify ──
  // Scoped to MIGRATED rows only. Summing every production-scoped row would also
  // pick up the print budget's production-linked lines and report a false
  // mismatch.
  const ledgerBudget = await prisma.costLine.aggregate({
    where: { kind: 'BUDGET', notes: { contains: MARKER_PREFIX } },
    _sum: { amount: true },
  })
  const ledgerActual = await prisma.costLine.aggregate({
    where: { kind: 'ACTUAL', description: ACTUAL_DESC },
    _sum: { amount: true },
  })

  const gotBudget = round2(ledgerBudget._sum.amount ?? 0)
  const gotActual = round2(ledgerActual._sum.amount ?? 0)

  console.log('\nVerification (production-scoped ledger rows):')
  console.log(`  budget: £${gotBudget.toLocaleString()}  expected £${srcBudget.toLocaleString()}  ${gotBudget === srcBudget ? '✓' : '✗ MISMATCH'}`)
  console.log(`  actual: £${gotActual.toLocaleString()}  expected £${srcActual.toLocaleString()}  ${gotActual === srcActual ? '✓' : '✗ MISMATCH'}`)

  if (gotBudget !== srcBudget || gotActual !== srcActual) {
    throw new Error('Totals do not reconcile — investigate before dropping BudgetLineItem')
  }
  console.log('\n✓ Reconciled.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
