import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import { getToken, setToken } from '@/lib/token-store'
import { fetchCalendarEvents, fetchBillingTracker } from '@/lib/fetch-dashboard-data'
import { scanBillingInbox } from '@/lib/billing-engine'
import { fetchAllXeroData } from '@/lib/xero-api'
import { crossReferenceDeals } from '@/lib/email-cross-ref'
import { withAuth } from '@/lib/auth'

const GET__h = withAuth(async (request: NextRequest) => {
  const billingTokenData = getToken('google_billing')
  const primaryTokenData = getToken('google_primary')

  const results: Record<string, unknown> = {
    connected: { billing: !!billingTokenData, primary: !!primaryTokenData },
  }

  if (billingTokenData) {
    results.billingAlerts = await scanBillingInbox(JSON.stringify(billingTokenData))
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

  const url = new URL(request.url)
  if (url.searchParams.get('crossref') === 'true' && (results.billingTracker as any)?.deals) {
    try {
      results.crossReference = await crossReferenceDeals(
        (results.billingTracker as any).deals,
        (results.xero as any)?.invoices || [],
        (results.billingAlerts as any[]) || []
      )
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json(results)
})

export const GET = withErrorHandling(GET__h as any)
