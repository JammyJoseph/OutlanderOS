// Pulling Xero into the mirror.
//
// Runs on a timer and on demand. Every entity is fetched incrementally using
// If-Modified-Since against a per-entity cursor, so a quarter-hourly sync costs
// a handful of calls rather than a full re-read of the ledger. Xero allows 60
// calls a minute and 5,000 a day per organisation; a full unfiltered sync of a
// few years of invoices is several hundred of those, and doing it on a loop
// would exhaust the day's allowance by lunchtime.
//
// Three rules hold throughout:
//
//  1. **Upsert on the Xero id, never insert.** A sync that runs twice must
//     leave the same rows. Xero's ids are stable and unique; ours are not
//     meaningful here.
//  2. **Advance the cursor only on success.** A partial failure that moved the
//     cursor would leave a permanent hole in the mirror that no later sync
//     would ever fill, and nothing would report it.
//  3. **One entity failing does not fail the rest.** Payments being unreadable
//     should not cost you the chart of accounts. Each entity records its own
//     outcome and the run is marked PARTIAL.
//
// The cursor is deliberately rewound by a small overlap on each run. Xero's
// UpdatedDateUTC has second granularity and its clock is not ours; an exact
// cursor drops records modified in the same second the previous sync read.

import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  XeroDisconnectedError,
  getXeroContext,
  toPence,
  xeroDate,
  xeroGet,
} from '@/lib/xero'

/** Rewind the cursor this far on each run, to cover clock skew and ties. */
const CURSOR_OVERLAP_MS = 5 * 60 * 1000

/** Xero pages collections at 100. Stop after this many pages per entity per
 *  run, so a first sync of a large org spreads over several runs instead of
 *  spending the whole rate limit at once. */
const MAX_PAGES = 20

type Entity = 'accounts' | 'tracking' | 'contacts' | 'invoices' | 'payments' | 'bank'

export interface EntityResult {
  fetched: number
  upserted: number
  pages: number
  error?: string
  skipped?: boolean
}

export type SyncReport = Record<string, EntityResult>

export interface SyncOutcome {
  runId: string
  status: 'OK' | 'PARTIAL' | 'FAILED'
  durationMs: number
  entities: SyncReport
  error?: string
}

async function cursorFor(entity: Entity): Promise<Date | null> {
  const state = await prisma.xeroSyncState.findUnique({ where: { entity } })
  if (!state?.lastModifiedUtc) return null
  return new Date(state.lastModifiedUtc.getTime() - CURSOR_OVERLAP_MS)
}

async function advanceCursor(entity: Entity, highWater: Date | null, count: number) {
  await prisma.xeroSyncState.upsert({
    where: { entity },
    create: { entity, lastModifiedUtc: highWater, lastRunAt: new Date(), lastCount: count },
    update: {
      // Never move the cursor backwards: a run that saw nothing new must not
      // undo the progress of the run before it.
      ...(highWater ? { lastModifiedUtc: highWater } : {}),
      lastRunAt: new Date(),
      lastCount: count,
    },
  })
}

/** Tracks the newest UpdatedDateUTC seen, which becomes the next cursor. */
function highWaterMark(current: Date | null, seen: Date | null): Date | null {
  if (!seen) return current
  if (!current) return seen
  return seen > current ? seen : current
}

// ── Entities ───────────────────────────────────────────────────────────────

async function syncAccounts(): Promise<EntityResult> {
  // The chart of accounts is small (tens of rows) and changes rarely, so it is
  // pulled whole. Incremental would save nothing and risks a stale picker.
  const data = await xeroGet<{ Accounts?: Array<Record<string, unknown>> }>('/Accounts')
  const accounts = data.Accounts ?? []
  let upserted = 0

  for (const a of accounts) {
    const xeroAccountId = String(a.AccountID ?? '')
    if (!xeroAccountId) continue
    const type = String(a.Type ?? '')
    const row = {
      code: a.Code ? String(a.Code) : null,
      name: String(a.Name ?? ''),
      type,
      accountClass: a.Class ? String(a.Class) : null,
      status: a.Status ? String(a.Status) : null,
      description: a.Description ? String(a.Description) : null,
      currencyCode: a.CurrencyCode ? String(a.CurrencyCode) : null,
      reportingCode: a.ReportingCode ? String(a.ReportingCode) : null,
      isBank: type === 'BANK',
      updatedDateUtc: xeroDate(a.UpdatedDateUTC),
      syncedAt: new Date(),
    }
    await prisma.xeroAccount.upsert({
      where: { xeroAccountId },
      create: { xeroAccountId, ...row },
      // balancePence is owned by syncBankBalances, not by this pull.
      update: row,
    })
    upserted++
  }
  return { fetched: accounts.length, upserted, pages: 1 }
}

async function syncTracking(): Promise<EntityResult> {
  const data = await xeroGet<{ TrackingCategories?: Array<Record<string, unknown>> }>(
    '/TrackingCategories'
  )
  const categories = data.TrackingCategories ?? []
  let upserted = 0

  for (const c of categories) {
    const xeroTrackingCategoryId = String(c.TrackingCategoryID ?? '')
    if (!xeroTrackingCategoryId) continue
    const category = await prisma.xeroTrackingCategory.upsert({
      where: { xeroTrackingCategoryId },
      create: {
        xeroTrackingCategoryId,
        name: String(c.Name ?? ''),
        status: c.Status ? String(c.Status) : null,
      },
      update: {
        name: String(c.Name ?? ''),
        status: c.Status ? String(c.Status) : null,
        syncedAt: new Date(),
      },
    })
    upserted++

    for (const o of (c.Options as Array<Record<string, unknown>>) ?? []) {
      const xeroTrackingOptionId = String(o.TrackingOptionID ?? '')
      if (!xeroTrackingOptionId) continue
      await prisma.xeroTrackingOption.upsert({
        where: { xeroTrackingOptionId },
        create: {
          xeroTrackingOptionId,
          categoryId: category.id,
          name: String(o.Name ?? ''),
          status: o.Status ? String(o.Status) : null,
        },
        update: {
          categoryId: category.id,
          name: String(o.Name ?? ''),
          status: o.Status ? String(o.Status) : null,
          syncedAt: new Date(),
        },
      })
      upserted++
    }
  }
  return { fetched: categories.length, upserted, pages: 1 }
}

async function syncContacts(): Promise<EntityResult> {
  const since = await cursorFor('contacts')
  let page = 1
  let fetched = 0
  let upserted = 0
  let high: Date | null = null

  for (; page <= MAX_PAGES; page++) {
    const data = await xeroGet<{ Contacts?: Array<Record<string, unknown>> }>('/Contacts', {
      modifiedSince: since,
      page,
    })
    const contacts = data.Contacts ?? []
    if (!contacts.length) break
    fetched += contacts.length

    for (const c of contacts) {
      const xeroContactId = String(c.ContactID ?? '')
      if (!xeroContactId) continue
      const updated = xeroDate(c.UpdatedDateUTC)
      high = highWaterMark(high, updated)
      const row = {
        name: String(c.Name ?? ''),
        emailAddress: c.EmailAddress ? String(c.EmailAddress) : null,
        accountNumber: c.AccountNumber ? String(c.AccountNumber) : null,
        defaultCurrency: c.DefaultCurrency ? String(c.DefaultCurrency) : null,
        isSupplier: c.IsSupplier === true,
        isCustomer: c.IsCustomer === true,
        status: c.ContactStatus ? String(c.ContactStatus) : null,
        updatedDateUtc: updated,
        syncedAt: new Date(),
      }
      await prisma.xeroContact.upsert({
        where: { xeroContactId },
        create: { xeroContactId, ...row },
        update: row,
      })
      upserted++
    }
    if (contacts.length < 100) break
  }

  await advanceCursor('contacts', high, upserted)
  return { fetched, upserted, pages: page }
}

async function syncInvoices(): Promise<EntityResult> {
  const since = await cursorFor('invoices')
  let page = 1
  let fetched = 0
  let upserted = 0
  let high: Date | null = null

  // Both ACCREC and ACCPAY in one pass — they live in one Xero collection and
  // one table here, so filtering by type would double the call count for no
  // gain. VOIDED and DELETED are included deliberately: a bill that vanishes
  // from Xero must stop counting towards payables here too, and the only way
  // to learn that is to see its new status.
  for (; page <= MAX_PAGES; page++) {
    const data = await xeroGet<{ Invoices?: Array<Record<string, unknown>> }>(
      '/Invoices?order=UpdatedDateUTC%20ASC',
      { modifiedSince: since, page }
    )
    const invoices = data.Invoices ?? []
    if (!invoices.length) break
    fetched += invoices.length

    for (const inv of invoices) {
      const xeroInvoiceId = String(inv.InvoiceID ?? '')
      if (!xeroInvoiceId) continue
      const updated = xeroDate(inv.UpdatedDateUTC)
      high = highWaterMark(high, updated)
      const contact = (inv.Contact as Record<string, unknown>) ?? {}
      const row = {
        type: String(inv.Type ?? ''),
        invoiceNumber: inv.InvoiceNumber ? String(inv.InvoiceNumber) : null,
        reference: inv.Reference ? String(inv.Reference) : null,
        status: String(inv.Status ?? ''),
        contactXeroId: contact.ContactID ? String(contact.ContactID) : null,
        contactName: String(contact.Name ?? ''),
        subTotalPence: toPence(inv.SubTotal),
        totalTaxPence: toPence(inv.TotalTax),
        totalPence: toPence(inv.Total),
        amountDuePence: toPence(inv.AmountDue),
        amountPaidPence: toPence(inv.AmountPaid),
        currencyCode: String(inv.CurrencyCode ?? 'GBP'),
        currencyRate: typeof inv.CurrencyRate === 'number' ? inv.CurrencyRate : null,
        date: xeroDate(inv.DateString ?? inv.Date),
        dueDate: xeroDate(inv.DueDateString ?? inv.DueDate),
        fullyPaidOnDate: xeroDate(inv.FullyPaidOnDate),
        updatedDateUtc: updated,
        syncedAt: new Date(),
      }
      await prisma.xeroInvoice.upsert({
        where: { xeroInvoiceId },
        create: { xeroInvoiceId, ...row },
        // Match pointers are OS-owned and must survive a re-sync.
        update: row,
      })
      upserted++
    }
    if (invoices.length < 100) break
  }

  await advanceCursor('invoices', high, upserted)
  return { fetched, upserted, pages: page }
}

async function syncPayments(): Promise<EntityResult> {
  const since = await cursorFor('payments')
  let page = 1
  let fetched = 0
  let upserted = 0
  let high: Date | null = null

  for (; page <= MAX_PAGES; page++) {
    const data = await xeroGet<{ Payments?: Array<Record<string, unknown>> }>(
      '/Payments?order=UpdatedDateUTC%20ASC',
      { modifiedSince: since, page }
    )
    const payments = data.Payments ?? []
    if (!payments.length) break
    fetched += payments.length

    for (const p of payments) {
      const xeroPaymentId = String(p.PaymentID ?? '')
      if (!xeroPaymentId) continue
      const updated = xeroDate(p.UpdatedDateUTC)
      high = highWaterMark(high, updated)
      const invoice = (p.Invoice as Record<string, unknown>) ?? {}
      const invoiceContact = (invoice.Contact as Record<string, unknown>) ?? {}
      const row = {
        invoiceXeroId: invoice.InvoiceID ? String(invoice.InvoiceID) : null,
        invoiceNumber: invoice.InvoiceNumber ? String(invoice.InvoiceNumber) : null,
        contactName: invoiceContact.Name ? String(invoiceContact.Name) : null,
        amountPence: toPence(p.Amount),
        currencyRate: typeof p.CurrencyRate === 'number' ? p.CurrencyRate : null,
        date: xeroDate(p.DateString ?? p.Date),
        reference: p.Reference ? String(p.Reference) : null,
        status: p.Status ? String(p.Status) : null,
        paymentType: p.PaymentType ? String(p.PaymentType) : null,
        updatedDateUtc: updated,
        syncedAt: new Date(),
      }
      await prisma.xeroPayment.upsert({
        where: { xeroPaymentId },
        create: { xeroPaymentId, ...row },
        update: row,
      })
      upserted++
    }
    if (payments.length < 100) break
  }

  await advanceCursor('payments', high, upserted)
  return { fetched, upserted, pages: page }
}

/**
 * Bank balances, from the BankSummary report.
 *
 * Not from /Accounts — the old client read `reportingCode` into a field called
 * `balance`, which is a chart-of-accounts label, not money. Every bank figure
 * the finance dashboard has ever shown came from that line.
 */
async function syncBankBalances(): Promise<EntityResult> {
  const data = await xeroGet<{ Reports?: Array<Record<string, unknown>> }>('/Reports/BankSummary')
  const report = data.Reports?.[0]
  if (!report) return { fetched: 0, upserted: 0, pages: 1, skipped: true }

  const asAt = new Date()
  let upserted = 0
  let fetched = 0

  // BankSummary rows carry the account name in the first cell and the closing
  // balance in the last. The account id is on the first cell's attributes.
  for (const section of (report.Rows as Array<Record<string, unknown>>) ?? []) {
    if (section.RowType !== 'Section') continue
    for (const row of (section.Rows as Array<Record<string, unknown>>) ?? []) {
      if (row.RowType !== 'Row') continue
      const cells = (row.Cells as Array<Record<string, unknown>>) ?? []
      if (cells.length < 2) continue
      fetched++

      const attrs = (cells[0]?.Attributes as Array<Record<string, unknown>>) ?? []
      const accountId = attrs.find((a) => a.Id === 'accountID')?.Value
      const closing = toPence(cells[cells.length - 1]?.Value)
      if (!accountId) continue

      const updated = await prisma.xeroAccount.updateMany({
        where: { xeroAccountId: String(accountId) },
        data: { balancePence: closing, balanceAsAt: asAt, isBank: true },
      })
      upserted += updated.count
    }
  }
  return { fetched, upserted, pages: 1 }
}

// ── The run ────────────────────────────────────────────────────────────────

const ENTITIES: Array<{ name: Entity; run: () => Promise<EntityResult> }> = [
  { name: 'accounts', run: syncAccounts },
  { name: 'tracking', run: syncTracking },
  { name: 'contacts', run: syncContacts },
  { name: 'invoices', run: syncInvoices },
  { name: 'payments', run: syncPayments },
  { name: 'bank', run: syncBankBalances },
]

/** Guards against two syncs overlapping in this process. */
let syncInFlight: Promise<SyncOutcome> | null = null

export function isSyncRunning(): boolean {
  return syncInFlight !== null
}

export async function runXeroSync(
  trigger: 'SCHEDULED' | 'MANUAL' | 'CONNECT' = 'MANUAL'
): Promise<SyncOutcome> {
  if (syncInFlight) return syncInFlight
  syncInFlight = doSync(trigger).finally(() => {
    syncInFlight = null
  })
  return syncInFlight
}

async function doSync(trigger: 'SCHEDULED' | 'MANUAL' | 'CONNECT'): Promise<SyncOutcome> {
  const started = Date.now()
  const run = await prisma.xeroSyncRun.create({ data: { trigger } })
  const entities: SyncReport = {}

  // Fail the whole run before touching anything if Xero is simply not there —
  // six identical "not connected" errors in the report tells nobody anything.
  try {
    await getXeroContext()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - started
    await prisma.xeroSyncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: 'FAILED', error: message.slice(0, 480), durationMs },
    })
    return { runId: run.id, status: 'FAILED', durationMs, entities, error: message }
  }

  let failures = 0
  for (const entity of ENTITIES) {
    try {
      entities[entity.name] = await entity.run()
    } catch (err) {
      failures++
      const message = err instanceof Error ? err.message : String(err)
      entities[entity.name] = { fetched: 0, upserted: 0, pages: 0, error: message.slice(0, 300) }
      console.error(`[xero-sync] ${entity.name} failed:`, message)
      // A dead connection will not fix itself for the entities behind this one.
      if (err instanceof XeroDisconnectedError && err.needsReconsent) break
    }
  }

  const durationMs = Date.now() - started
  const status = failures === 0 ? 'OK' : failures === ENTITIES.length ? 'FAILED' : 'PARTIAL'
  await prisma.xeroSyncRun.update({
    where: { id: run.id },
    // Cast: SyncReport is a plain record of plain fields, but Prisma's Json
    // input type can't infer that through the index signature.
    data: {
      finishedAt: new Date(),
      status,
      entities: entities as unknown as Prisma.InputJsonValue,
      durationMs,
    },
  })

  const total = Object.values(entities).reduce((n, e) => n + e.upserted, 0)
  console.log(`[xero-sync] ${status} in ${durationMs}ms, ${total} rows, trigger ${trigger}`)
  return { runId: run.id, status, durationMs, entities }
}

/** What the dashboard shows above the numbers. */
export async function lastSyncSummary() {
  const [last, lastOk] = await Promise.all([
    prisma.xeroSyncRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.xeroSyncRun.findFirst({
      where: { status: { in: ['OK', 'PARTIAL'] } },
      orderBy: { startedAt: 'desc' },
    }),
  ])
  return {
    lastRunAt: last?.startedAt?.toISOString() ?? null,
    lastRunStatus: last?.status ?? null,
    lastRunError: last?.error ?? null,
    freshAsOf: lastOk?.finishedAt?.toISOString() ?? null,
    running: isSyncRunning(),
  }
}
