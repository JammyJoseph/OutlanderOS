import { NextRequest, NextResponse } from 'next/server'
import { processAgentMessage } from '@/lib/ai-agent'
import { getToken } from '@/lib/token-store'
import { fetchBillingTracker, fetchCalendarEvents } from '@/lib/fetch-dashboard-data'
import { fetchAllXeroData } from '@/lib/xero-api'
import { scanBillingInbox } from '@/lib/billing-engine'

export async function POST(request: NextRequest) {
  const { message } = await request.json()
  if (!message) return NextResponse.json({ error: 'No message' }, { status: 400 })

  const primaryToken = getToken('google_primary')
  const billingToken = getToken('google_billing')
  const xeroToken = getToken('xero')

  const dashboardData: any = {}

  if (primaryToken) {
    dashboardData.billingTracker = await fetchBillingTracker(JSON.stringify(primaryToken))
    dashboardData.calendar = await fetchCalendarEvents(JSON.stringify(primaryToken))
  }

  if (billingToken) {
    dashboardData.billingAlerts = await scanBillingInbox(JSON.stringify(billingToken))
  }

  if (xeroToken) {
    const xero = await fetchAllXeroData(JSON.stringify(xeroToken))
    dashboardData.xero = xero.data
  }

  const response = await processAgentMessage(message, dashboardData)
  return NextResponse.json(response)
}
