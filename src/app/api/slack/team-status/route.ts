import { NextResponse } from 'next/server'
import { createSlackClient, getTeamMembers, getUserPresence } from '@/lib/slack-client'

const TEAM_EMAILS = [
  'silver@outlandermag.com',
  'q@outlandermag.com',
  'shreeya@outlandermag.com',
]

export async function GET() {
  const client = createSlackClient()
  if (!client) {
    return NextResponse.json({ error: 'Slack not configured', members: [] })
  }

  try {
    const slackMembers = await getTeamMembers(client)

    // Match Slack users to team by email
    const matched = slackMembers.filter(m =>
      TEAM_EMAILS.some(email => m.profile?.email?.toLowerCase() === email.toLowerCase())
    )

    const withPresence = await Promise.all(
      matched.map(async m => {
        let presence = 'unknown'
        try {
          if (m.id) presence = (await getUserPresence(client, m.id)) ?? 'unknown'
        } catch {
          // ignore presence errors for individual users
        }
        return {
          id: m.id,
          name: m.profile?.real_name ?? m.name,
          email: m.profile?.email,
          presence,
          statusText: m.profile?.status_text,
          statusEmoji: m.profile?.status_emoji,
        }
      })
    )

    return NextResponse.json({ members: withPresence })
  } catch (err) {
    console.error('Slack team-status error:', err)
    return NextResponse.json({ error: String(err), members: [] })
  }
}
