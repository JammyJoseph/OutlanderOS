import { NextResponse } from 'next/server'
import { createSlackClient, getTeamMembers, getUserPresence } from '@/lib/slack-client'
import { withAuth } from '@/lib/auth'

const TEAM = [
  { name: 'Joe Silver', email: 'silver@outlandermag.com' },
  { name: 'Quinn Titsworth', email: 'q@outlandermag.com' },
  { name: 'Shreeya Patel', email: 'shreeya@outlandermag.com' },
  { name: 'Callum', email: '' },
  { name: 'Patricia', email: '' },
]

export const GET = withAuth(async () => {
  const client = createSlackClient()
  if (!client) {
    return NextResponse.json({
      members: TEAM.map(t => ({
        name: t.name,
        email: t.email,
        presence: 'unknown',
        statusText: '',
        statusEmoji: '',
      })),
    })
  }

  try {
    const slackMembers = await getTeamMembers(client)

    const matched = TEAM.map(teamMember => {
      let slackUser = null

      if (teamMember.email) {
        slackUser = slackMembers.find(
          m => m.profile?.email?.toLowerCase() === teamMember.email.toLowerCase()
        ) ?? null
      }

      if (!slackUser) {
        const firstName = teamMember.name.split(' ')[0].toLowerCase()
        slackUser = slackMembers.find(m => {
          const realName = (m.profile?.real_name ?? m.name ?? '').toLowerCase()
          const displayName = (m.profile?.display_name ?? '').toLowerCase()
          return realName.startsWith(firstName) || displayName.startsWith(firstName)
        }) ?? null
      }

      return { teamMember, slackUser }
    })

    const withPresence = await Promise.all(
      matched.map(async ({ teamMember, slackUser }) => {
        let presence = 'unknown'
        if (slackUser?.id) {
          try {
            presence = (await getUserPresence(client, slackUser.id)) ?? 'unknown'
          } catch {
            // ignore individual presence errors
          }
        }
        return {
          name: teamMember.name,
          email: teamMember.email || slackUser?.profile?.email || '',
          presence,
          statusText: slackUser?.profile?.status_text ?? '',
          statusEmoji: slackUser?.profile?.status_emoji ?? '',
        }
      })
    )

    return NextResponse.json({ members: withPresence })
  } catch (err) {
    console.error('Slack team-status error:', err)
    return NextResponse.json({
      error: String(err),
      members: TEAM.map(t => ({
        name: t.name,
        email: t.email,
        presence: 'unknown',
        statusText: '',
        statusEmoji: '',
      })),
    })
  }
})
