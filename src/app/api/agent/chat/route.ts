import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import { processAgentMessage } from '@/lib/ai-agent'
import { addChatMessage, addLearnedFact } from '@/lib/chat-memory'
import { getToken } from '@/lib/token-store'
import { fetchBillingTracker, fetchCalendarEvents } from '@/lib/fetch-dashboard-data'
import { fetchAllXeroData } from '@/lib/xero-api'
import { scanBillingInbox } from '@/lib/billing-engine'
import { withAuth } from '@/lib/auth'
import { sanitizeString } from '@/lib/validate'

const POST__h = withAuth(async (request: NextRequest) => {
  const body = await request.json()
  const message = sanitizeString(body?.message, 4000)
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

  // Persist conversation to memory
  addChatMessage('user', message)
  addChatMessage('assistant', response.operationsMessage)

  // Extract any facts the agent explicitly noted
  const learnPattern = /(?:I(?:'ll| will) (?:note|remember|keep in mind) that|Important to note:|Noted:)\s+(.+?)(?:\.|$)/gi
  let match
  while ((match = learnPattern.exec(response.operationsMessage)) !== null) {
    addLearnedFact(match[1].trim())
  }

  return NextResponse.json(response)
})

export const POST = withErrorHandling(POST__h as any)
