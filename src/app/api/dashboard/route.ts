import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { fetchCalendarEvents, fetchBillingTracker } from '@/lib/fetch-dashboard-data'
import { scanBillingInbox } from '@/lib/billing-engine'
import { fetchAllXeroData } from '@/lib/xero-api'

export async function GET() {
  const cookieStore = await cookies()
  const billingToken = cookieStore.get('google_billing_token')?.value
  const primaryToken = cookieStore.get('google_primary_token')?.value
  const xeroToken = cookieStore.get('xero_token')?.value

  const results: Record<string, unknown> = {
    connected: { billing: !!billingToken, primary: !!primaryToken },
  }

  if (billingToken) {
    results.billingAlerts = await scanBillingInbox(billingToken)
  }

  if (primaryToken) {
    results.calendar = await fetchCalendarEvents(primaryToken)
    results.billingTracker = await fetchBillingTracker(primaryToken)
  }

  if (xeroToken) {
    const xeroResult = await fetchAllXeroData(xeroToken)
    results.xero = xeroResult.data

    if (xeroResult.updatedTokenJson) {
      const response = NextResponse.json(results)
      response.cookies.set('xero_token', xeroResult.updatedTokenJson, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      })
      return response
    }
  }

  return NextResponse.json(results)
}
