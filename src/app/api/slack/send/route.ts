import { NextRequest, NextResponse } from 'next/server'
import { createSlackClient, sendMessage } from '@/lib/slack-client'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { channel, text } = body

  if (!channel || !text) {
    return NextResponse.json({ error: 'channel and text are required' }, { status: 400 })
  }

  const client = createSlackClient()
  if (!client) {
    return NextResponse.json({ error: 'Slack not configured' }, { status: 503 })
  }

  try {
    const result = await sendMessage(client, channel, text)
    return NextResponse.json({ ok: result.ok, ts: result.ts })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
