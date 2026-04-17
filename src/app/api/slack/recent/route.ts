import { NextResponse } from 'next/server'
import { createSlackClient, getChannels, getChannelMessages } from '@/lib/slack-client'

export async function GET() {
  const client = createSlackClient()
  if (!client) return NextResponse.json({ messages: [] })

  try {
    const channels = await getChannels(client)
    const allMessages: any[] = []

    for (const ch of channels.slice(0, 5)) {
      if (!ch.id) continue
      try {
        const msgs = await getChannelMessages(client, ch.id, 5)
        for (const msg of msgs) {
          if (msg.text && !msg.bot_id) {
            allMessages.push({
              channel: ch.name || 'unknown',
              text: msg.text.substring(0, 120),
              user: msg.user || '',
              timestamp: msg.ts ? new Date(parseFloat(msg.ts) * 1000).toISOString() : '',
            })
          }
        }
      } catch { /* skip channel if error */ }
    }

    allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({ messages: allMessages.slice(0, 10) })
  } catch (e) {
    return NextResponse.json({ messages: [], error: String(e) })
  }
}
