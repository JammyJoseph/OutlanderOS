import { google } from 'googleapis'
import { getToken } from './token-store'

export interface DealStatus {
  client: string
  ioNumber?: string
  emailEvidence: {
    ioMentioned: boolean
    signedMentioned: boolean
    invoiceMentioned: boolean
    paymentMentioned: boolean
    lastEmailDate: string
    lastEmailSubject: string
    threadCount: number
  }
  xeroStatus: {
    hasInvoice: boolean
    invoicePaid: boolean
    amountInvoiced: number
    amountOutstanding: number
  }
  spreadsheetStatus: {
    signed: boolean
    invoiceSent: boolean
    annualTotal: string
  }
  flags: string[]
}

export async function crossReferenceDeals(
  deals: any[],
  xeroInvoices: any[],
  billingAlerts: any[]
): Promise<DealStatus[]> {
  const primaryToken = getToken('google_primary')

  const statuses: DealStatus[] = []

  for (const deal of deals) {
    if (!deal.client) continue
    const clientName = deal.client.toLowerCase()

    let emailEvidence = {
      ioMentioned: false,
      signedMentioned: false,
      invoiceMentioned: false,
      paymentMentioned: false,
      lastEmailDate: '',
      lastEmailSubject: '',
      threadCount: 0,
    }

    if (primaryToken) {
      try {
        const auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        )
        auth.setCredentials(JSON.parse(JSON.stringify(primaryToken)))
        const gmail = google.gmail({ version: 'v1', auth })

        const searchResult = await gmail.users.messages.list({
          userId: 'me',
          q: `${deal.client} newer_than:30d`,
          maxResults: 10,
        })

        emailEvidence.threadCount = searchResult.data.resultSizeEstimate || 0

        for (const msg of (searchResult.data.messages || []).slice(0, 3)) {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['Subject', 'Date'],
          })
          const subject =
            detail.data.payload?.headers?.find((h) => h.name === 'Subject')?.value || ''
          const date =
            detail.data.payload?.headers?.find((h) => h.name === 'Date')?.value || ''
          const snippet = (detail.data.snippet || '').toLowerCase()
          const subjectLower = subject.toLowerCase()

          if (!emailEvidence.lastEmailDate) {
            emailEvidence.lastEmailDate = date
            emailEvidence.lastEmailSubject = subject
          }

          if (
            subjectLower.includes('io') ||
            subjectLower.includes('insertion order') ||
            snippet.includes('io ')
          )
            emailEvidence.ioMentioned = true
          if (
            subjectLower.includes('signed') ||
            subjectLower.includes('executed') ||
            snippet.includes('signed') ||
            snippet.includes('docusign')
          )
            emailEvidence.signedMentioned = true
          if (subjectLower.includes('invoice') || snippet.includes('invoice'))
            emailEvidence.invoiceMentioned = true
          if (
            subjectLower.includes('payment') ||
            subjectLower.includes('paid') ||
            snippet.includes('payment') ||
            snippet.includes('transferred')
          )
            emailEvidence.paymentMentioned = true
        }
      } catch {
        // Silently handle — don't break the whole scan
      }
    }

    let xeroStatus = {
      hasInvoice: false,
      invoicePaid: false,
      amountInvoiced: 0,
      amountOutstanding: 0,
    }
    if (xeroInvoices) {
      const matchingInvoices = xeroInvoices.filter(
        (inv: any) =>
          inv.contact?.toLowerCase().includes(clientName) ||
          clientName.includes(inv.contact?.toLowerCase() || '')
      )
      if (matchingInvoices.length > 0) {
        xeroStatus.hasInvoice = true
        xeroStatus.amountInvoiced = matchingInvoices.reduce(
          (sum: number, inv: any) => sum + (inv.total || 0),
          0
        )
        xeroStatus.amountOutstanding = matchingInvoices.reduce(
          (sum: number, inv: any) => sum + (inv.amountDue || 0),
          0
        )
        xeroStatus.invoicePaid = xeroStatus.amountOutstanding === 0
      }
    }

    const flags: string[] = []
    if (emailEvidence.signedMentioned && !deal.signed)
      flags.push('Email suggests IO is signed but spreadsheet shows unsigned')
    if (deal.signed && !xeroStatus.hasInvoice && deal.invoiceSent)
      flags.push('Spreadsheet says invoice sent but no matching Xero invoice found')
    if (xeroStatus.invoicePaid && emailEvidence.paymentMentioned)
      flags.push('Payment confirmed in both email and Xero ✓')
    if (xeroStatus.amountOutstanding > 0 && !emailEvidence.invoiceMentioned)
      flags.push('Xero shows outstanding balance but no recent invoice emails')
    if (emailEvidence.threadCount === 0)
      flags.push('No recent emails found for this client (30 days)')

    statuses.push({
      client: deal.client,
      ioNumber: deal.ioNumber,
      emailEvidence,
      xeroStatus,
      spreadsheetStatus: {
        signed: !!deal.signed,
        invoiceSent: !!deal.invoiceSent,
        annualTotal: deal.annualTotal || '£0',
      },
      flags,
    })
  }

  return statuses
}
