import { NextResponse } from 'next/server'
import { createSlackClient, getTeamMembers, getUserPresence } from '@/lib/slack-client'

export async function GET() {
  const client = createSlackClient()
  if (!client) {
    return NextResponse.json({ error: 'Slack not configured' }, { status: 503 })
  }

  try {
    const members = await getTeamMembers(client)
    const presenceResults = await Promise.allSettled(
      members.slice(0, 20).map(async m => {
        if (!m.id) return { id: m.id, name: m.real_name, presence: 'unknown' }
        const presence = await getUserPresence(client, m.id)
        return { id: m.id, name: m.real_name, presence }
      })
    )
    const statuses = presenceResults
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<{ id: string | undefined; name: string | undefined; presence: string | undefined }>).value)
    return NextResponse.json({ statuses })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch team status' }, { status: 500 })
  }
}
