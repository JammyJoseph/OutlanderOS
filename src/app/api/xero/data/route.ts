import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  getXeroProfitAndLoss,
  getXeroBankSummary,
  getXeroInvoices,
  getXeroOrganisation,
  getXeroAgedReceivables,
} from '@/lib/xero-client'

export async function GET() {
  const cookieStore = await cookies()
  const tokenJson = cookieStore.get('xero_token')?.value

  if (!tokenJson) {
    return NextResponse.json({ connected: false })
  }

  try {
    const [org, pnl, banks, invoices, agedReceivables] = await Promise.all([
      getXeroOrganisation(tokenJson),
      getXeroProfitAndLoss(tokenJson),
      getXeroBankSummary(tokenJson),
      getXeroInvoices(tokenJson, 'ACCREC'),
      getXeroAgedReceivables(tokenJson),
    ])

    return NextResponse.json({
      connected: true,
      organisation: org?.name ?? null,
      pnl,
      banks,
      invoices,
      agedReceivables,
    })
  } catch (err) {
    console.error('Xero data error:', err)
    return NextResponse.json({ connected: true, error: String(err) })
  }
}
