import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { getXeroStatus } from '@/lib/xero'
import { lastSyncSummary } from '@/lib/xero-sync'
import {
  getXeroAgedPayables,
  getXeroAgedReceivables,
  getXeroBankAccounts,
  getXeroBankBalance,
  getXeroBills,
  getXeroInvoices,
  getXeroProfitAndLoss,
} from '@/lib/xero-finance'

// A single read of everything Xero-shaped, served from the mirror.
//
// This previously called `fetchAllXeroData`, which made eight live Xero
// requests per page load and refreshed the token inline. It is now eight
// indexed Postgres queries, so it cannot fail because Xero is slow and cannot
// contribute to exhausting the org's rate limit.
//
// `connected: false` still means what it always did — the connection is gone
// and somebody must reconnect — but the numbers alongside it remain readable,
// with `sync.freshAsOf` saying how old they are.
export const GET = withAuth(async () => {
  const year = new Date().getFullYear()
  const from = `${year}-01-01`
  const to = new Date().toISOString().slice(0, 10)

  const [status, sync, pl, bank, bankAccounts, invoices, bills, receivables, payables] =
    await Promise.all([
      getXeroStatus(),
      lastSyncSummary(),
      getXeroProfitAndLoss(from, to),
      getXeroBankBalance(),
      getXeroBankAccounts(),
      getXeroInvoices('AUTHORISED'),
      getXeroBills('AUTHORISED'),
      getXeroAgedReceivables(),
      getXeroAgedPayables(),
    ])

  return NextResponse.json({
    connected: status.connected,
    organisation: status.organisation,
    error: status.error,
    needsReconsent: status.needsReconsent,
    sync,
    profitAndLoss: pl,
    bank,
    bankAccounts,
    invoices,
    bills,
    agedReceivables: receivables,
    agedPayables: payables,
  })
})
