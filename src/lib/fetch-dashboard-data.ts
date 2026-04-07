import { google } from 'googleapis'
import { setToken } from '@/lib/token-store'

function createAuthClient(tokenJson: string, storeKey?: string) {
  const tokens = JSON.parse(tokenJson)
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  client.setCredentials(tokens)

  if (storeKey) {
    client.on('tokens', (newTokens) => {
      const updated = { ...tokens, ...newTokens }
      setToken(storeKey, updated)
    })
  }

  return client
}

export async function fetchCalendarEvents(primaryToken: string) {
  try {
    const auth = createAuthClient(primaryToken, 'google_primary')
    const calendar = google.calendar({ version: 'v3', auth })

    const now = new Date()
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59)

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 10,
    })

    return {
      todayEvents: (res.data.items || []).map(event => ({
        id: event.id,
        summary: event.summary || 'No title',
        start: event.start?.dateTime || event.start?.date || '',
        end: event.end?.dateTime || event.end?.date || '',
        location: event.location || '',
      })),
    }
  } catch (error) {
    console.error('Failed to fetch calendar:', error)
    return { todayEvents: [], error: String(error) }
  }
}

export async function fetchBillingTracker(primaryToken: string) {
  try {
    const auth = createAuthClient(primaryToken, 'google_primary')
    const sheets = google.sheets({ version: 'v4', auth })

    const SHEET_ID = '19v0t5A2Of3_-Pho1tuaWMgHAHzm-30ejrK88SNqaYHs'

    // Fetch Deal Tracker 2026 tab — summary cells + data
    const summaryRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'Deal Tracker 2026'!A1:N50",
    })

    const rows = summaryRes.data.values || []

    // Parse summary: Row 2 has "Booked Revenue to Date" in col C, value in col D
    let bookedRevenue = '—'
    let gapToTarget = '—'
    for (const row of rows.slice(0, 5)) {
      if (row[2]?.includes('Booked Revenue')) bookedRevenue = row[3] || '—'
      if (row[2]?.includes('Gap to target')) gapToTarget = row[3] || '—'
    }

    // Parse deals: starts at row 7 (index 6), columns: A=row, B=IO, C=Client, D=Campaign, ...
    // H=Q1, I=Q2, J=Q3, K=Q4, L=Annual Total, M=Margin%
    const deals: Array<{
      id: number
      ioNumber: string
      client: string
      campaign: string
      dateBooked: string
      q1: string
      q2: string
      q3: string
      q4: string
      annualTotal: string
      margin: string
      signed: boolean
      invoiceSent: boolean
      billingInfo: string[]
    }> = []

    // Also fetch Billing Tracker tab for invoice status first so we can map per-deal
    let invoiceSummary = { signed: 0, unsigned: 0, invoicesSent: 0, invoicesNotSent: 0 }
    let billingRows: string[][] = []
    // Build a map from client name → {signed, invoiceSent, row} for deal enrichment
    const billingByClient: Record<string, { signed: boolean; invoiceSent: boolean; row: string[] }> = {}
    try {
      const billingRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Billing Tracker!A1:I50',
      })
      const rawBilling = billingRes.data.values || []
      for (let i = 3; i < rawBilling.length; i++) {
        const row = rawBilling[i]
        if (!row || !row[2]) continue
        billingRows.push(row as string[])
        const signed = row[0] === 'TRUE'
        const invoiceSent = row[7] === 'TRUE'
        if (signed) invoiceSummary.signed++
        else invoiceSummary.unsigned++
        if (invoiceSent) invoiceSummary.invoicesSent++
        else invoiceSummary.invoicesNotSent++
        // row[2] = client name in billing tracker
        const clientKey = (row[2] as string).trim().toLowerCase()
        billingByClient[clientKey] = { signed, invoiceSent, row: row as string[] }
      }
    } catch (e) {
      console.error('Failed to fetch billing tracker tab:', e)
    }

    // Parse quarterly totals accumulators
    let q1Total = 0, q2Total = 0, q3Total = 0, q4Total = 0

    for (let i = 6; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[2]) continue // skip if no client name
      const clientKey = (row[2] as string).trim().toLowerCase()
      const billing = billingByClient[clientKey] ?? { signed: false, invoiceSent: false, row: [] }

      const parseAmt = (v: string) => {
        if (!v) return 0
        return parseFloat(v.replace(/[£,\s]/g, '')) || 0
      }
      q1Total += parseAmt(row[7])
      q2Total += parseAmt(row[8])
      q3Total += parseAmt(row[9])
      q4Total += parseAmt(row[10])

      deals.push({
        id: deals.length,
        ioNumber: row[1] || '',
        client: row[2] || '',
        campaign: row[3] || '',
        dateBooked: row[4] || '',
        q1: row[7] || '',
        q2: row[8] || '',
        q3: row[9] || '',
        q4: row[10] || '',
        annualTotal: row[11] || '£0',
        margin: row[12] || '',
        signed: billing.signed,
        invoiceSent: billing.invoiceSent,
        billingInfo: billing.row,
      })
    }

    const quarterlyTotals = { q1: q1Total, q2: q2Total, q3: q3Total, q4: q4Total }

    // Fetch INVOICING 2026 tab for detailed invoice data
    let invoicingRows: string[][] = []
    try {
      const invoicingRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'INVOICING 2026!A1:AK50',
      })
      invoicingRows = (invoicingRes.data.values || []) as string[][]
    } catch (e) {
      console.error('Failed to fetch INVOICING 2026 tab:', e)
    }

    return {
      bookedRevenue,
      gapToTarget,
      totalDeals: deals.length,
      deals: deals.slice(0, 10), // Top 10 for dashboard
      allDeals: deals,
      invoiceSummary,
      billingRows,
      invoicingRows,
      quarterlyTotals,
    }
  } catch (error) {
    console.error('Failed to fetch billing tracker:', error)
    return {
      bookedRevenue: '—',
      gapToTarget: '—',
      totalDeals: 0,
      deals: [],
      allDeals: [],
      invoiceSummary: { signed: 0, unsigned: 0, invoicesSent: 0, invoicesNotSent: 0 },
      billingRows: [],
      invoicingRows: [],
      quarterlyTotals: { q1: 0, q2: 0, q3: 0, q4: 0 },
      error: String(error),
    }
  }
}
