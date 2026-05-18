import { withErrorHandling } from "@/lib/api-error"
import { NextResponse } from 'next/server'
import { getToken } from '@/lib/token-store'
import { fetchBillingTracker, fetchCalendarEvents } from '@/lib/fetch-dashboard-data'
import { fetchAllXeroData } from '@/lib/xero-api'
import { scanBillingInbox } from '@/lib/billing-engine'
import { sendTelegramMessage } from '@/lib/telegram'
import { withAuth } from '@/lib/auth'

const GET__h = withAuth(async () => {
  const primaryToken = getToken('google_primary')
  const billingToken = getToken('google_billing')
  const xeroToken = getToken('xero')

  let overdueInvoices = 0
  let unsignedDeals = 0
  let pendingInvoices = 0
  let paymentsReceived = 0
  let todayEvents: string[] = []
  let urgentAlerts: string[] = []

  if (xeroToken) {
    try {
      const xero = await fetchAllXeroData(JSON.stringify(xeroToken))
      if (xero.data?.invoices) {
        overdueInvoices = xero.data.invoices.filter((i: any) => i.status === 'OVERDUE').length
        paymentsReceived = xero.data.invoices.filter((i: any) => i.amountDue === 0).length
      }
    } catch {
      // Non-fatal
    }
  }

  if (primaryToken) {
    try {
      const tracker = await fetchBillingTracker(JSON.stringify(primaryToken))
      if (tracker?.deals) {
        unsignedDeals = tracker.deals.filter((d: any) => !d.signed).length
        pendingInvoices = tracker.deals.filter((d: any) => d.signed && !d.invoiceSent).length
      }
    } catch {
      // Non-fatal
    }

    try {
      const cal = await fetchCalendarEvents(JSON.stringify(primaryToken))
      if (cal?.todayEvents) {
        todayEvents = cal.todayEvents.map((e: any) => {
          const timeStr = e.start
            ? new Date(e.start).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''
          return `${timeStr} ${e.summary}`.trim()
        })
      }
    } catch {
      // Non-fatal
    }
  }

  if (billingToken) {
    try {
      const alerts = await scanBillingInbox(JSON.stringify(billingToken))
      urgentAlerts = alerts
        .filter((a) => a.priority === 'urgent')
        .map((a) => `${a.client}: ${a.subject}`)
    } catch {
      // Non-fatal
    }
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  let message = `📋 <b>${greeting}, Quinn</b>\n${dateStr}\n\n`
  message += `<b>Today's Priorities:</b>\n`

  if (overdueInvoices > 0)
    message += `🔴 ${overdueInvoices} overdue invoice${overdueInvoices > 1 ? 's' : ''}\n`
  if (unsignedDeals > 0)
    message += `🟡 ${unsignedDeals} unsigned deal${unsignedDeals > 1 ? 's' : ''} awaiting IO\n`
  if (pendingInvoices > 0)
    message += `🟡 ${pendingInvoices} invoice${pendingInvoices > 1 ? 's' : ''} to send\n`
  if (paymentsReceived > 0)
    message += `🟢 ${paymentsReceived} payment${paymentsReceived > 1 ? 's' : ''} received\n`

  if (
    overdueInvoices === 0 &&
    unsignedDeals === 0 &&
    pendingInvoices === 0 &&
    paymentsReceived === 0
  ) {
    message += `✅ No outstanding actions\n`
  }

  if (urgentAlerts.length > 0) {
    message += `\n<b>Urgent:</b>\n`
    for (const alert of urgentAlerts.slice(0, 3)) {
      message += `⚠️ ${alert}\n`
    }
  }

  if (todayEvents.length > 0) {
    message += `\n<b>Schedule:</b>\n`
    for (const event of todayEvents.slice(0, 5)) {
      message += `📅 ${event}\n`
    }
  }

  message += `\n— OutlanderOS`

  const sent = await sendTelegramMessage(message)

  return NextResponse.json({
    sent,
    message,
    summary: {
      overdueInvoices,
      unsignedDeals,
      pendingInvoices,
      paymentsReceived,
      todayEvents: todayEvents.length,
      urgentAlerts: urgentAlerts.length,
    },
  })
})

export const GET = withErrorHandling(GET__h as any)
