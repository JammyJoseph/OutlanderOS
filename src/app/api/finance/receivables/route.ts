import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { getXeroInvoices, getXeroStatus } from '@/lib/xero-finance'

export const dynamic = 'force-dynamic'

// Xero invoices sent to clients (outgoing receivables) with payment status.
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const status = request.nextUrl.searchParams.get('status') || undefined
    const [conn, invoices] = await Promise.all([getXeroStatus(), getXeroInvoices(status)])
    const total = invoices.reduce((s, i) => s + i.amount, 0)
    const totalDue = invoices.reduce((s, i) => s + i.amountDue, 0)
    return NextResponse.json({
      xeroConnected: conn.connected,
      xeroError: conn.error ?? null,
      invoices,
      total,
      totalDue,
      count: invoices.length,
    })
  } catch (e) {
    return NextResponse.json({ invoices: [], total: 0, totalDue: 0, count: 0, error: String(e) }, { status: 500 })
  }
})
