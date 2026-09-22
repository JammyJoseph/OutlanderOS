import { NextResponse } from 'next/server'
import { getToken, setToken } from '@/lib/token-store'
import { fetchCalendarEvents, fetchBillingTracker } from '@/lib/fetch-dashboard-data'
import { getXeroBankBalance, getXeroProfitAndLoss } from '@/lib/xero-finance'
import { getXeroStatus } from '@/lib/xero'
import { withAuth } from '@/lib/auth'

export const GET = withAuth(async () => {
  const billingTokenData = getToken('google_billing')
  const primaryTokenData = getToken('google_primary')

  const results: Record<string, unknown> = {
    connected: { billing: !!billingTokenData, primary: !!primaryTokenData },
  }

  if (primaryTokenData) {
    results.calendar = await fetchCalendarEvents(JSON.stringify(primaryTokenData))
    results.billingTracker = await fetchBillingTracker(JSON.stringify(primaryTokenData))
  }

  // From the mirror, not from Xero. The dashboard is the most-loaded page in
  // the app and it used to make eight live Xero calls on every render.
  const xeroStatus = await getXeroStatus()
  const year = new Date().getFullYear()
  const [profitAndLoss, bank] = await Promise.all([
    getXeroProfitAndLoss(`${year}-01-01`, new Date().toISOString().slice(0, 10)),
    getXeroBankBalance(),
  ])
  results.xero = {
    connected: xeroStatus.connected,
    organisation: xeroStatus.organisation,
    profitAndLoss,
    bank,
  }

  return NextResponse.json(results)
})
