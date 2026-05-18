import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import { createSlackClient, sendMessage } from '@/lib/slack-client'
import { withAuth } from '@/lib/auth'
import { validateRequired, sanitizeString } from '@/lib/validate'

const POST__h = withAuth(async (request: NextRequest) => {
  const body = await request.json()

  const missing = validateRequired(body, ['channel', 'text'])
  if (missing) return NextResponse.json({ error: missing }, { status: 400 })

  const channel = sanitizeString(body.channel, 200)
  const text = sanitizeString(body.text, 4000)

  const client = createSlackClient()
  if (!client) {
    return NextResponse.json({ error: 'Slack not configured' }, { status: 503 })
  }

  try {
    const result = await sendMessage(client, channel, text)
    return NextResponse.json({ ok: result.ok, ts: result.ts })
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
})

export const POST = withErrorHandling(POST__h as any)
