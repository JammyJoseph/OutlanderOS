// The finance portal's view of Xero — served from the local mirror.
//
// Every function here used to open an HTTPS connection to Xero on each call.
// One render of the finance dashboard was a dozen of them; nine tabs and a few
// people clicking around would exhaust the org's 5,000-a-day allowance and take
// the portal down for everyone. Worse, it meant Xero being slow made OS slow,
// and Xero being down made OS wrong.
//
// Now every one of these reads Postgres. `src/lib/xero-sync.ts` keeps the
// mirror current; `lastSyncSummary()` tells the UI how current. The exported
// signatures are unchanged, so the six existing callers needed no edits — they
// simply stopped talking to the internet.
//
// Money crosses this boundary as pounds, because that is what the existing
// callers and the existing UI expect. It is stored as integer pence and only
// divided on the way out, so nothing accumulates a rounding error on the way.

import prisma from '@/lib/prisma'
import type { InvoiceSubmission } from '@prisma/client'
import { fromPence } from '@/lib/xero'

export { XeroDisconnectedError, getXeroStatus } from '@/lib/xero'

// ── Shapes, unchanged from the live-call era ───────────────────────────────

interface XeroInvoiceShape {
  id: string
  contact: string
  amount: number
  amountDue: number
  amountPaid: number
  status: string
  date: string
  dueDate: string
}

interface AgedRow {
  contact: string
  total: number
  current: number
  period1: number
  period2: number
  period3: number
}

interface XeroPaymentShape {
  id: string
  date: string
  amount: number
  reference: string
  contact: string
  invoiceNumber: string
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

/**
 * Statuses that represent a real, live document.
 *
 * VOIDED and DELETED are mirrored deliberately — that is how OS learns a bill
 * has been cancelled — but they must never reach a total. Leaving them in is
 * how a payables figure stays stubbornly high after somebody voids an invoice
 * in Xero and cannot work out why.
 */
const LIVE = ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'PAID']

function toShape(inv: {
  xeroInvoiceId: string
  contactName: string
  totalPence: number
  amountDuePence: number
  amountPaidPence: number
  status: string
  date: Date | null
  dueDate: Date | null
}): XeroInvoiceShape {
  return {
    id: inv.xeroInvoiceId,
    contact: inv.contactName,
    amount: fromPence(inv.totalPence),
    amountDue: fromPence(inv.amountDuePence),
    amountPaid: fromPence(inv.amountPaidPence),
    status: inv.status,
    date: iso(inv.date),
    dueDate: iso(inv.dueDate),
  }
}

async function invoicesOfType(type: 'ACCREC' | 'ACCPAY', status?: string) {
  const rows = await prisma.xeroInvoice.findMany({
    where: { type, status: status ? status : { in: LIVE } },
    orderBy: { date: 'desc' },
    take: 500,
  })
  return rows.map(toShape)
}

/** What we invoiced others. Inbound money. */
export async function getXeroInvoices(status?: string): Promise<XeroInvoiceShape[]> {
  return invoicesOfType('ACCREC', status)
}

/** What others invoiced us. Outbound money. */
export async function getXeroBills(status?: string): Promise<XeroInvoiceShape[]> {
  return invoicesOfType('ACCPAY', status)
}

// ── P&L ────────────────────────────────────────────────────────────────────

/**
 * Accrual profit and loss over a date range, derived from invoices.
 *
 * **This is invoice-derived, not Xero's own P&L report.** It is the sum of
 * ACCREC subtotals minus ACCPAY subtotals, ex VAT, for documents dated in the
 * window. It therefore excludes manual journals, bank transactions not raised
 * against an invoice, depreciation and accruals — everything a bookkeeper does
 * directly in Xero.
 *
 * That is the right number for this portal and the wrong number for statutory
 * reporting, and the distinction matters enough to say out loud. It is the
 * figure that reconciles against the CostLine ledger, because the ledger is
 * also built from invoices; a P&L including journals would differ from our own
 * budgets by amounts nobody could trace back to a cost line.
 *
 * Subtotals rather than totals because the platform rule is that CostLine
 * amounts are always ex-VAT. Comparing a VAT-inclusive total against an
 * ex-VAT budget overstates spend by a fifth.
 */
export async function getXeroProfitAndLoss(
  fromDate: string,
  toDate: string
): Promise<{ revenue: number; expenses: number; profit: number; details: unknown }> {
  const from = new Date(fromDate)
  const to = new Date(toDate)
  // Xero dates are date-only; include the whole of the closing day.
  to.setHours(23, 59, 59, 999)

  const grouped = await prisma.xeroInvoice.groupBy({
    by: ['type'],
    where: { status: { in: LIVE }, date: { gte: from, lte: to } },
    _sum: { subTotalPence: true, totalTaxPence: true },
    _count: true,
  })

  const bucket = (type: string) => grouped.find((g) => g.type === type)
  const revenuePence = bucket('ACCREC')?._sum.subTotalPence ?? 0
  const expensesPence = bucket('ACCPAY')?._sum.subTotalPence ?? 0

  return {
    revenue: fromPence(revenuePence),
    expenses: fromPence(expensesPence),
    profit: fromPence(revenuePence - expensesPence),
    details: {
      basis: 'accrual, invoice-derived, ex VAT',
      excludes: 'manual journals, bank transactions not raised against an invoice',
      from: fromDate,
      to: toDate,
      salesInvoices: bucket('ACCREC')?._count ?? 0,
      purchaseBills: bucket('ACCPAY')?._count ?? 0,
      vatOnSales: fromPence(bucket('ACCREC')?._sum.totalTaxPence ?? 0),
      vatOnPurchases: fromPence(bucket('ACCPAY')?._sum.totalTaxPence ?? 0),
    },
  }
}

// ── Bank ───────────────────────────────────────────────────────────────────

/**
 * Cash across every bank account.
 *
 * The figure this replaces came from `Account.reportingCode` — a chart-of-
 * accounts classification string — being read into a field named `balance`.
 * Every bank number the finance dashboard has ever displayed was that. This one
 * comes from the BankSummary report's closing balance.
 */
export async function getXeroBankBalance(): Promise<{ balance: number; accountName: string }> {
  const accounts = await prisma.xeroAccount.findMany({
    where: { isBank: true, balancePence: { not: null } },
    orderBy: { name: 'asc' },
  })
  if (!accounts.length) return { balance: 0, accountName: '' }

  const total = accounts.reduce((sum, a) => sum + (a.balancePence ?? 0), 0)
  return {
    balance: fromPence(total),
    accountName: accounts.length === 1 ? accounts[0].name : `${accounts.length} bank accounts`,
  }
}

/** Every bank account separately, for the dashboard's cash panel. */
export async function getXeroBankAccounts(): Promise<
  Array<{ name: string; code: string | null; balance: number; asAt: string | null }>
> {
  const accounts = await prisma.xeroAccount.findMany({
    where: { isBank: true },
    orderBy: { name: 'asc' },
  })
  return accounts.map((a) => ({
    name: a.name,
    code: a.code,
    balance: fromPence(a.balancePence ?? 0),
    asAt: a.balanceAsAt?.toISOString() ?? null,
  }))
}

// ── Aging ──────────────────────────────────────────────────────────────────

/**
 * Buckets unpaid documents by how overdue they are.
 *
 * Derived from invoices rather than Xero's aged reports, which require a
 * contactId and would be one call per contact. Identical logic serves both
 * directions — an overdue bill and an overdue invoice differ only in who is
 * embarrassed.
 */
function bucketAged(invoices: XeroInvoiceShape[]): AgedRow[] {
  const now = Date.now()
  const byContact = new Map<string, AgedRow>()
  for (const inv of invoices) {
    if (inv.amountDue <= 0) continue
    const row =
      byContact.get(inv.contact) ??
      { contact: inv.contact, total: 0, current: 0, period1: 0, period2: 0, period3: 0 }
    const due = inv.dueDate ? new Date(inv.dueDate).getTime() : now
    const daysOverdue = Math.floor((now - due) / 86_400_000)
    row.total += inv.amountDue
    if (daysOverdue <= 0) row.current += inv.amountDue
    else if (daysOverdue <= 30) row.period1 += inv.amountDue
    else if (daysOverdue <= 60) row.period2 += inv.amountDue
    else row.period3 += inv.amountDue
    byContact.set(inv.contact, row)
  }
  return Array.from(byContact.values()).sort((a, b) => b.total - a.total)
}

/** Who owes us. */
export async function getXeroAgedReceivables(): Promise<AgedRow[]> {
  return bucketAged(await invoicesOfType('ACCREC', 'AUTHORISED'))
}

/** Who we owe. */
export async function getXeroAgedPayables(): Promise<AgedRow[]> {
  return bucketAged(await invoicesOfType('ACCPAY', 'AUTHORISED'))
}

// ── Payments ───────────────────────────────────────────────────────────────

export async function getXeroPayments(
  fromDate: string,
  toDate: string
): Promise<XeroPaymentShape[]> {
  const to = new Date(toDate)
  to.setHours(23, 59, 59, 999)

  const rows = await prisma.xeroPayment.findMany({
    where: { date: { gte: new Date(fromDate), lte: to } },
    orderBy: { date: 'desc' },
    take: 500,
  })
  return rows.map((p) => ({
    id: p.xeroPaymentId,
    date: iso(p.date),
    amount: fromPence(p.amountPence),
    reference: p.reference ?? '',
    contact: p.contactName ?? '',
    invoiceNumber: p.invoiceNumber ?? '',
  }))
}

/**
 * Matches a payment against an outstanding supplier invoice in OS.
 *
 * Unchanged in behaviour, and deliberately conservative: amount within a penny
 * scores 2, a supplier-name overlap scores 2, and nothing below 2 is a match.
 * It is the seed of the reconciliation engine, not the finished thing — an
 * invoice number appearing in the reference is the signal worth adding next,
 * and it is the one that resolves most real cases.
 */
export async function matchPaymentToInvoice(
  payment: { amount?: number; contact?: string; reference?: string },
  invoices: InvoiceSubmission[]
): Promise<string | null> {
  const amount = payment.amount ?? 0
  const contact = (payment.contact || '').toLowerCase().trim()
  const ref = (payment.reference || '').toLowerCase()
  let best: { id: string; score: number } | null = null

  for (const inv of invoices) {
    if (inv.status === 'PAID') continue
    let score = 0
    if (inv.amount != null && Math.abs(inv.amount - amount) < 0.01) score += 2
    const supplier = (inv.supplierName || '').toLowerCase().trim()
    if (supplier && contact && (supplier.includes(contact) || contact.includes(supplier))) score += 2
    if (supplier && ref.includes(supplier)) score += 1
    if (score >= 2 && (!best || score > best.score)) best = { id: inv.id, score }
  }
  return best?.id ?? null
}
