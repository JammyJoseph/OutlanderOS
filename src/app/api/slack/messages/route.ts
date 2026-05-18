import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import { createSlackClient, getChannelMessages } from '@/lib/slack-client'
import { withAuth } from '@/lib/auth'

const GET__h = withAuth(async (request: NextRequest) => {
  const channelId = request.nextUrl.searchParams.get('channelId')
  const limit = Number(request.nextUrl.searchParams.get('limit') || '20')

  if (!channelId) {
    return NextResponse.json({ error: 'channelId is required' }, { status: 400 })
  }

  const client = createSlackClient()
  if (!client) {
    return NextResponse.json({ error: 'Slack not configured' }, { status: 503 })
  }

  try {
    const messages = await getChannelMessages(client, channelId, limit)
    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
})

export const GET = withErrorHandling(GET__h as any)
