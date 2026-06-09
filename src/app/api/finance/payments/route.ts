import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { getXeroPayments, getXeroStatus } from '@/lib/xero-finance'

export const dynamic = 'force-dynamic'

// Payments made/received in a date range. Defaults to the last 90 days.
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const params = request.nextUrl.searchParams
    const now = new Date()
    const defaultFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const fromDate = params.get('fromDate') || defaultFrom.toISOString().split('T')[0]
    const toDate = params.get('toDate') || now.toISOString().split('T')[0]

    const [conn, payments] = await Promise.all([getXeroStatus(), getXeroPayments(fromDate, toDate)])
    const total = payments.reduce((s, p) => s + p.amount, 0)
    return NextResponse.json({
      xeroConnected: conn.connected,
      xeroError: conn.error ?? null,
      fromDate,
      toDate,
      payments,
      total,
      count: payments.length,
    })
  } catch (e) {
    return NextResponse.json({ payments: [], total: 0, count: 0, error: String(e) }, { status: 500 })
  }
})
