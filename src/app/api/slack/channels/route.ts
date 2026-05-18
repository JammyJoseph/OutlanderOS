import { withErrorHandling } from "@/lib/api-error"
import { NextResponse } from 'next/server'
import { createSlackClient, getChannels } from '@/lib/slack-client'
import { withAuth } from '@/lib/auth'

const GET__h = withAuth(async () => {
  const client = createSlackClient()
  if (!client) {
    return NextResponse.json({ error: 'Slack not configured' }, { status: 503 })
  }
  try {
    const channels = await getChannels(client)
    return NextResponse.json({ channels })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
})

export const GET = withErrorHandling(GET__h as any)
