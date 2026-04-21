import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getToken } from '@/lib/token-store'

export async function POST() {
  const primaryToken = getToken('google_primary')
  const billingToken = getToken('google_billing')

  const briefs: {
    title: string
    from: string
    date: string
    subject: string
    snippet: string
    emailId: string
  }[] = []

  for (const [label, tokenData] of [
    ['primary', primaryToken],
    ['billing', billingToken],
  ] as const) {
    if (!tokenData) continue
    try {
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      )
      auth.setCredentials(tokenData as Record<string, unknown>)
      const gmail = google.gmail({ version: 'v1', auth })

      const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'subject:"NEW BRIEF" newer_than:30d',
        maxResults: 10,
      })

      for (const msg of (res.data.messages ?? []).slice(0, 5)) {
        if (!msg.id) continue
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        })
        const headers = detail.data.payload?.headers ?? []
        const subject = headers.find((h) => h.name === 'Subject')?.value ?? ''
        const from = headers.find((h) => h.name === 'From')?.value ?? ''
        const date = headers.find((h) => h.name === 'Date')?.value ?? ''

        const brandMatch = subject.match(/NEW BRIEF[:\s-]*(.+)/i)
        const brandName = brandMatch
          ? brandMatch[1].trim()
          : subject.replace(/NEW BRIEF/i, '').trim()

        briefs.push({
          title: brandName || 'New Brief',
          from,
          date,
          subject,
          snippet: detail.data.snippet ?? '',
          emailId: msg.id,
        })
      }
    } catch (e) {
      console.error(`Email scan (${label}) error:`, e)
    }
  }

  return NextResponse.json({ briefs })
}
