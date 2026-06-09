import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { getXeroAgedPayables, getXeroStatus } from '@/lib/xero-finance'

export const dynamic = 'force-dynamic'

// Aged payables — who you owe, bucketed by how overdue the bills are.
export const GET = withAuth(async () => {
  try {
    const [conn, rows] = await Promise.all([getXeroStatus(), getXeroAgedPayables()])
    const total = rows.reduce((s, r) => s + r.total, 0)
    return NextResponse.json({
      xeroConnected: conn.connected,
      xeroError: conn.error ?? null,
      rows,
      total,
      count: rows.length,
    })
  } catch (e) {
    return NextResponse.json({ rows: [], total: 0, count: 0, error: String(e) }, { status: 500 })
  }
})
