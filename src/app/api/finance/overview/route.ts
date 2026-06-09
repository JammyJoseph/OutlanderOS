import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import {
  getXeroProfitAndLoss,
  getXeroBankBalance,
  getXeroInvoices,
  getXeroStatus,
} from '@/lib/xero-finance'

export const dynamic = 'force-dynamic'

// Finance overview: P&L (year to date), bank balance, outstanding + overdue
// receivables. Degrades gracefully when Xero is disconnected.
export const GET = withAuth(async () => {
  try {
    const now = new Date()
    const fromDate = `${now.getFullYear()}-01-01`
    const toDate = now.toISOString().split('T')[0]

    const [status, pl, bank, invoices] = await Promise.all([
      getXeroStatus(),
      getXeroProfitAndLoss(fromDate, toDate),
      getXeroBankBalance(),
      getXeroInvoices('AUTHORISED'),
    ])

    const nowMs = Date.now()
    const outstanding = invoices.reduce((s, i) => s + i.amountDue, 0)
    const overdue = invoices.reduce((s, i) => {
      const due = i.dueDate ? new Date(i.dueDate).getTime() : nowMs
      return due < nowMs ? s + i.amountDue : s
    }, 0)

    return NextResponse.json({
      xeroConnected: status.connected,
      xeroError: status.error ?? null,
      organisation: status.organisation ?? null,
      profitAndLoss: pl,
      bankBalance: bank,
      outstandingInvoices: outstanding,
      overdueTotal: overdue,
      invoiceCount: invoices.length,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
})
