import { google } from 'googleapis'

function createAuthClient(tokenJson: string) {
  const tokens = JSON.parse(tokenJson)
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  client.setCredentials(tokens)
  return client
}

export async function fetchBillingEmails(billingToken: string) {
  try {
    const auth = createAuthClient(billingToken)
    const gmail = google.gmail({ version: 'v1', auth })

    // Get unread count
    const unreadRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 1,
    })

    // Get recent emails
    const recentRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
    })

    // Get details of recent emails
    const emails = []
    for (const msg of (recentRes.data.messages || []).slice(0, 5)) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      })
      const headers = detail.data.payload?.headers || []
      emails.push({
        id: msg.id,
        from: headers.find(h => h.name === 'From')?.value || '',
        subject: headers.find(h => h.name === 'Subject')?.value || '',
        date: headers.find(h => h.name === 'Date')?.value || '',
        snippet: detail.data.snippet || '',
        unread: (detail.data.labelIds || []).includes('UNREAD'),
      })
    }

    return {
      unreadCount: unreadRes.data.resultSizeEstimate || 0,
      recentEmails: emails,
    }
  } catch (error) {
    console.error('Failed to fetch billing emails:', error)
    return { unreadCount: 0, recentEmails: [], error: String(error) }
  }
}

export async function fetchCalendarEvents(primaryToken: string) {
  try {
    const auth = createAuthClient(primaryToken)
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
    const auth = createAuthClient(primaryToken)
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
      ioNumber: string
      client: string
      campaign: string
      dateBooked: string
      annualTotal: string
      margin: string
    }> = []
    for (let i = 6; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[2]) continue // skip if no client name
      deals.push({
        ioNumber: row[1] || '',
        client: row[2] || '',
        campaign: row[3] || '',
        dateBooked: row[4] || '',
        annualTotal: row[11] || '£0',
        margin: row[12] || '',
      })
    }

    // Also fetch Billing Tracker tab for invoice status
    let invoiceSummary = { signed: 0, unsigned: 0, invoicesSent: 0, invoicesNotSent: 0 }
    try {
      const billingRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: "'Billing Tracker'!A1:I50",
      })
      const billingRows = billingRes.data.values || []
      for (let i = 3; i < billingRows.length; i++) {
        const row = billingRows[i]
        if (!row || !row[2]) continue
        if (row[0] === 'TRUE') invoiceSummary.signed++
        else invoiceSummary.unsigned++
        if (row[7] === 'TRUE') invoiceSummary.invoicesSent++
        else invoiceSummary.invoicesNotSent++
      }
    } catch (e) {
      console.error('Failed to fetch billing tracker tab:', e)
    }

    return {
      bookedRevenue,
      gapToTarget,
      totalDeals: deals.length,
      deals: deals.slice(0, 10), // Top 10 for dashboard
      allDeals: deals,
      invoiceSummary,
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
      error: String(error),
    }
  }
}
