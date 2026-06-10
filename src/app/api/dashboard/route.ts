import { NextResponse } from 'next/server'
import { getToken, setToken } from '@/lib/token-store'
import { fetchCalendarEvents, fetchBillingTracker } from '@/lib/fetch-dashboard-data'
import { fetchAllXeroData } from '@/lib/xero-api'
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

  const xeroTokenData = getToken('xero')
  if (xeroTokenData) {
    const xeroResult = await fetchAllXeroData(JSON.stringify(xeroTokenData))
    results.xero = xeroResult.data
    if (xeroResult.updatedTokenJson) {
      setToken('xero', JSON.parse(xeroResult.updatedTokenJson))
    }
  }

  return NextResponse.json(results)
})
