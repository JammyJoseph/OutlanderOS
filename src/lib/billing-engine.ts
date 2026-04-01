import { google } from 'googleapis'

export interface BillingAlert {
  id: string
  type: 'invoice_received' | 'payment_overdue' | 'follow_up_needed' | 'payment_confirmed' | 'new_inquiry'
  priority: 'urgent' | 'high' | 'medium' | 'low'
  subject: string
  from: string
  date: string
  snippet: string
  client: string
  amount?: string
  dueDate?: string
  emailId: string
}

export async function scanBillingInbox(tokenJson: string): Promise<BillingAlert[]> {
  try {
    const tokens = JSON.parse(tokenJson)
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    client.setCredentials(tokens)
    const gmail = google.gmail({ version: 'v1', auth: client })

    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 30,
      q: 'newer_than:7d',
    })

    const alerts: BillingAlert[] = []

    for (const msg of (res.data.messages || []).slice(0, 20)) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      })

      const headers = detail.data.payload?.headers || []
      const from = headers.find(h => h.name === 'From')?.value || ''
      const subject = headers.find(h => h.name === 'Subject')?.value || ''
      const date = headers.find(h => h.name === 'Date')?.value || ''
      const snippet = detail.data.snippet || ''

      const subjectLower = subject.toLowerCase()
      const snippetLower = snippet.toLowerCase()

      let type: BillingAlert['type'] = 'new_inquiry'
      let priority: BillingAlert['priority'] = 'medium'

      if (subjectLower.includes('invoice') || subjectLower.includes('billing')) {
        type = 'invoice_received'
        priority = 'high'
      }
      if (subjectLower.includes('overdue') || snippetLower.includes('overdue') || snippetLower.includes('past due')) {
        type = 'payment_overdue'
        priority = 'urgent'
      }
      if (
        subjectLower.includes('payment') &&
        (snippetLower.includes('confirmed') || snippetLower.includes('received') || snippetLower.includes('processed'))
      ) {
        type = 'payment_confirmed'
        priority = 'low'
      }
      if (subjectLower.includes('follow') || subjectLower.includes('reminder') || subjectLower.includes('chase')) {
        type = 'follow_up_needed'
        priority = 'high'
      }

      // Extract client name from subject
      let extractedClient = 'Unknown'
      const billingMatch = subject.match(/BILLING\s*[-–]\s*(.+?)\s*[xX×]\s*Outlander/i)
      if (billingMatch) {
        extractedClient = billingMatch[1].trim()
      } else {
        const invoiceMatch = subject.match(/Invoice.*?(?:for|from)\s+(?:outlander\s*[\/\\]\s*)?(.+?)(?:\s*$|\s*-)/i)
        if (invoiceMatch) extractedClient = invoiceMatch[1].trim()
      }

      // Extract amount if present
      const amountMatch = snippet.match(/[£$€]\s*[\d,]+(?:\.\d{2})?/)
      const amount = amountMatch ? amountMatch[0] : undefined

      alerts.push({
        id: msg.id!,
        type,
        priority,
        subject,
        from,
        date,
        snippet,
        client: extractedClient,
        amount,
        emailId: msg.id!,
      })
    }

    const priorityOrder: Record<BillingAlert['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 }
    alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    return alerts
  } catch (error) {
    console.error('Failed to scan billing inbox:', error)
    return []
  }
}
