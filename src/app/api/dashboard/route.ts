import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { fetchCalendarEvents, fetchBillingTracker } from '@/lib/fetch-dashboard-data'
import { scanBillingInbox } from '@/lib/billing-engine'

export async function GET() {
  const cookieStore = await cookies()
  const billingToken = cookieStore.get('google_billing_token')?.value
  const primaryToken = cookieStore.get('google_primary_token')?.value

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

  return NextResponse.json(results)
}
