import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { getXeroBills, getXeroStatus } from '@/lib/xero-finance'

export const dynamic = 'force-dynamic'

// Xero bills received from suppliers (payables).
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const status = request.nextUrl.searchParams.get('status') || undefined
    const [conn, bills] = await Promise.all([getXeroStatus(), getXeroBills(status)])
    const total = bills.reduce((s, b) => s + b.amount, 0)
    const totalDue = bills.reduce((s, b) => s + b.amountDue, 0)
    return NextResponse.json({
      xeroConnected: conn.connected,
      xeroError: conn.error ?? null,
      bills,
      total,
      totalDue,
      count: bills.length,
    })
  } catch (e) {
    return NextResponse.json({ bills: [], total: 0, totalDue: 0, count: 0, error: String(e) }, { status: 500 })
  }
})
