import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { fetchCalendarEvents, fetchBillingTracker } from '@/lib/fetch-dashboard-data'
import { scanBillingInbox } from '@/lib/billing-engine'
import { getXeroProfitAndLoss, getXeroBankSummary } from '@/lib/xero-client'

export async function GET() {
  const cookieStore = await cookies()
  const billingToken = cookieStore.get('google_billing_token')?.value
  const primaryToken = cookieStore.get('google_primary_token')?.value
  const xeroToken = cookieStore.get('xero_token')?.value

  const results: Record<string, unknown> = {
    connected: { billing: !!billingToken, primary: !!primaryToken, xero: !!xeroToken },
  }

  if (billingToken) {
    results.billingAlerts = await scanBillingInbox(billingToken)
  }

  if (primaryToken) {
    results.calendar = await fetchCalendarEvents(primaryToken)
    results.billingTracker = await fetchBillingTracker(primaryToken)
  }

  if (xeroToken) {
    try {
      const [pnl, banks] = await Promise.all([
        getXeroProfitAndLoss(xeroToken),
        getXeroBankSummary(xeroToken),
      ])
      // Total bank balance across all accounts
      const totalBankBalance = banks.reduce((sum, b) => sum + b.balance, 0)
      results.xero = { pnl, totalBankBalance }
    } catch (err) {
      console.error('Dashboard xero error:', err)
      results.xero = { error: String(err) }
    }
  }

  return NextResponse.json(results)
}
