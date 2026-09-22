// Every money figure in the finance portal, with its provenance attached.
//
// The portal currently shows Xero-sourced numbers beside ledger-sourced numbers
// with nothing distinguishing them. That is fine while both are right and
// actively dangerous when one is stale: a bank balance from Xero four hours ago
// and a budget total typed in last month look identical, and the reader has no
// way to know which they are trusting.
//
// So no figure leaves this module as a bare number. Each carries:
//
//   layer   ACTUAL     it happened. Xero saw the money move, or the invoice
//                      exists. Not an opinion.
//           COMMITTED  agreed but not yet in Xero — a signed IO, an approved
//                      supplier invoice awaiting payment.
//           FORECAST   expected. A deal in the pipeline, a budget line not yet
//                      spent. Will change.
//   source  which system said so, in words a person would use
//   asOf    when that was last true. Null means "live from our own database".
//
// The three layers are the whole architecture of this portal. Xero owns what
// happened; OutlanderOS owns what is expected; neither guesses at the other's
// job, and the reader is always told which they are looking at.
//
// ── The accuracy rule ──────────────────────────────────────────────────────
//
// Uncoded spend is REPORTED, never distributed, never hidden. A cost with no
// account code and no tracking option belongs to no production and no deal, and
// the honest thing to show is "£12,400 across 3 lines is unattributed". Spread
// it across projects on a guess and every project's figure becomes slightly
// wrong in a way nobody can audit, which is how a finance tool stops being
// believed. One visibly missing number is recoverable; twenty quietly wrong ones
// are not.

import prisma from '@/lib/prisma'
import { fromPence } from '@/lib/xero'
import { lastSyncSummary } from '@/lib/xero-sync'

export type Layer = 'ACTUAL' | 'COMMITTED' | 'FORECAST'

export interface Figure {
  value: number
  layer: Layer
  /** Which system is the authority for this number. */
  source: string
  /** When it was last known to be true. Null = read live from our database. */
  asOf: string | null
  /** How many records make it up, where that is meaningful. */
  count?: number
  /** Shown under the figure when there is something the reader must know. */
  note?: string
}

/**
 * Rounds to whole pence at the boundary.
 *
 * Not cosmetic. The ledger stores money as Float, so summing it produces things
 * like -439868.94999999995 — which is what this function returned before it
 * existed. Every figure here crosses into JSON and then into a currency
 * formatter, and a value that is a fraction of a penny off is a value that will
 * eventually disagree with Xero by a penny and cost somebody an afternoon.
 *
 * This is a plaster on Float, not a fix. The fix is integer pence in the ledger
 * itself, which the Xero mirror already uses and CostLine does not yet. See
 * docs/BACKLOG.md §1b.
 */
const pence = (n: number): number => Math.round(n * 100) / 100

const figure = (
  value: number,
  layer: Layer,
  source: string,
  extra: Partial<Figure> = {}
): Figure => ({ value: pence(value), layer, source, asOf: null, ...extra })

/** Xero's live statuses. VOIDED and DELETED are mirrored but never counted. */
const LIVE = ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'PAID']

export interface FinancePosition {
  cash: Figure
  receivableOutstanding: Figure
  receivableOverdue: Figure
  payableOutstanding: Figure
  payableOverdue: Figure
  committedSpend: Figure
  forecastSpend: Figure
  forecastIncome: Figure
  /** The accuracy signal. Spend that belongs to nothing. */
  uncodedSpend: Figure
  /** Cash + what we are owed − what we owe. ACTUAL only, no forecasting. */
  netPositionActual: Figure
  /** The same, plus committed and forecast. Softer, and labelled as such. */
  netPositionProjected: Figure
  xero: {
    connected: boolean
    organisation: string | null
    error: string | null
    freshAsOf: string | null
    lastRunStatus: string | null
    /** True when the mirror is empty — so zeros mean "unknown", not "nothing". */
    empty: boolean
  }
}

export async function financePosition(): Promise<FinancePosition> {
  const now = new Date()

  const [
    sync,
    connection,
    bankAccounts,
    receivables,
    payables,
    ledger,
    uncoded,
    approvedInvoices,
    pipeline,
    mirrorCount,
  ] = await Promise.all([
    lastSyncSummary(),
    prisma.xeroConnection.findUnique({ where: { id: 'singleton' } }),
    prisma.xeroAccount.findMany({ where: { isBank: true }, select: { balancePence: true, balanceAsAt: true } }),

    // Money owed TO us, and the overdue slice of it.
    prisma.xeroInvoice.findMany({
      where: { type: 'ACCREC', status: { in: LIVE }, amountDuePence: { gt: 0 } },
      select: { amountDuePence: true, dueDate: true },
    }),
    // Money we owe.
    prisma.xeroInvoice.findMany({
      where: { type: 'ACCPAY', status: { in: LIVE }, amountDuePence: { gt: 0 } },
      select: { amountDuePence: true, dueDate: true },
    }),

    // Our own ledger, by kind. BUDGET and ACTUAL are separate rows by design,
    // so this is a GROUP BY rather than a comparison of two columns.
    prisma.costLine.groupBy({ by: ['kind'], _sum: { amount: true }, _count: true }),

    // Spend that belongs to nothing: no Xero code, and no context of any kind.
    prisma.costLine.aggregate({
      where: {
        kind: { in: ['COMMITTED', 'ACTUAL'] },
        accountCode: null,
        trackingOption: null,
        magazinePlanId: null,
        productionId: null,
        campaignId: null,
      },
      _sum: { amount: true },
      _count: true,
    }),

    // Supplier invoices approved in OS but not yet paid — agreed, not yet cash.
    prisma.invoiceSubmission.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
      _count: true,
    }),

    // Deals with a value that are not yet lost or archived. Expected income.
    prisma.campaign.findMany({
      where: { archived: false, stage: { notIn: ['PAID', 'COMPLETED'] } },
      select: { dealValue: true, value: true, ioSigned: true },
    }),

    prisma.xeroInvoice.count(),
  ])

  const asOf = sync.freshAsOf
  const overdue = (rows: Array<{ amountDuePence: number; dueDate: Date | null }>) =>
    rows.filter((r) => r.dueDate && r.dueDate < now)
  const sumPence = (rows: Array<{ amountDuePence: number }>) =>
    rows.reduce((n, r) => n + r.amountDuePence, 0)

  const bankPence = bankAccounts.reduce((n, a) => n + (a.balancePence ?? 0), 0)
  const bankAsAt = bankAccounts.find((a) => a.balanceAsAt)?.balanceAsAt?.toISOString() ?? asOf

  const receivableOverdueRows = overdue(receivables)
  const payableOverdueRows = overdue(payables)

  const byKind = (kind: string) => ledger.find((g) => g.kind === kind)
  const budgetTotal = byKind('BUDGET')?._sum.amount ?? 0
  const actualTotal = byKind('ACTUAL')?._sum.amount ?? 0
  const committedLedger = byKind('COMMITTED')?._sum.amount ?? 0

  // A deal counts as committed once the IO is signed and forecast before that.
  // The IO is the first point at which the client has put their name to a
  // number, which is the only defensible line between "hoped for" and "agreed".
  const dealValue = (d: { dealValue: number | null; value: number | null }) =>
    d.dealValue ?? d.value ?? 0
  const committedIncome = pipeline.filter((d) => d.ioSigned).reduce((n, d) => n + dealValue(d), 0)
  const forecastIncome = pipeline.filter((d) => !d.ioSigned).reduce((n, d) => n + dealValue(d), 0)

  const cash = fromPence(bankPence)
  const owedToUs = fromPence(sumPence(receivables))
  const weOwe = fromPence(sumPence(payables))

  // Budget not yet drawn down. Cannot go below zero — an overspent budget line
  // has no remaining forecast, it has an overspend, and that belongs in the
  // budget-vs-actual view rather than being netted off here.
  const forecastSpend = Math.max(0, budgetTotal - actualTotal - committedLedger)

  const committedSpend = committedLedger + (approvedInvoices._sum.amount ?? 0)

  return {
    cash: figure(cash, 'ACTUAL', 'Xero bank accounts', {
      asOf: bankAsAt,
      count: bankAccounts.length,
      note: bankAccounts.length ? undefined : 'No bank account has been synced yet.',
    }),

    receivableOutstanding: figure(owedToUs, 'ACTUAL', 'Xero sales invoices', {
      asOf,
      count: receivables.length,
    }),
    receivableOverdue: figure(
      fromPence(sumPence(receivableOverdueRows)),
      'ACTUAL',
      'Xero sales invoices past their due date',
      { asOf, count: receivableOverdueRows.length }
    ),

    payableOutstanding: figure(weOwe, 'ACTUAL', 'Xero bills', { asOf, count: payables.length }),
    payableOverdue: figure(
      fromPence(sumPence(payableOverdueRows)),
      'ACTUAL',
      'Xero bills past their due date',
      { asOf, count: payableOverdueRows.length }
    ),

    committedSpend: figure(committedSpend, 'COMMITTED', 'Cost ledger and approved invoices', {
      count: (byKind('COMMITTED')?._count ?? 0) + approvedInvoices._count,
      note: 'Agreed, not yet paid or in Xero.',
    }),
    forecastSpend: figure(forecastSpend, 'FORECAST', 'Unspent budget lines', {
      count: byKind('BUDGET')?._count ?? 0,
      note: 'Budgeted and not yet committed or spent.',
    }),
    forecastIncome: figure(forecastIncome, 'FORECAST', 'Deals without a signed IO', {
      count: pipeline.filter((d) => !d.ioSigned).length,
      note: committedIncome
        ? `A further ${committedIncome.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })} is on signed IOs.`
        : undefined,
    }),

    uncodedSpend: figure(uncoded._sum.amount ?? 0, 'ACTUAL', 'Cost ledger', {
      count: uncoded._count,
      note: uncoded._count
        ? 'Belongs to no production, deal or issue. Not counted anywhere else.'
        : 'Every cost is attributed.',
    }),

    netPositionActual: figure(cash + owedToUs - weOwe, 'ACTUAL', 'Cash, plus owed to us, less owed', {
      asOf,
      note: 'Money that exists or is invoiced. No forecasting.',
    }),
    netPositionProjected: figure(
      cash + owedToUs - weOwe + committedIncome + forecastIncome - committedSpend - forecastSpend,
      'FORECAST',
      'Actual position plus committed and forecast',
      { note: 'Includes deals not yet won and budgets not yet spent.' }
    ),

    xero: {
      connected: !!connection && !connection.lastError,
      organisation: connection?.tenantName ?? null,
      error: connection?.lastError ?? sync.lastRunError ?? null,
      freshAsOf: sync.freshAsOf,
      lastRunStatus: sync.lastRunStatus,
      empty: mirrorCount === 0,
    },
  }
}
