import { WebClient } from '@slack/web-api'

export function createSlackClient(token?: string) {
  const slackToken = token || process.env.SLACK_BOT_TOKEN
  if (!slackToken) return null
  return new WebClient(slackToken)
}

export async function getChannels(client: WebClient) {
  const result = await client.conversations.list({ types: 'public_channel,private_channel' })
  return result.channels || []
}

export async function getChannelMessages(client: WebClient, channelId: string, limit = 20) {
  const result = await client.conversations.history({ channel: channelId, limit })
  return result.messages || []
}

export async function getUserPresence(client: WebClient, userId: string) {
  const result = await client.users.getPresence({ user: userId })
  return result.presence
}

export async function getTeamMembers(client: WebClient) {
  const result = await client.users.list({})
  return result.members?.filter(m => !m.is_bot && !m.deleted) || []
}

export async function sendMessage(client: WebClient, channel: string, text: string) {
  return client.chat.postMessage({ channel, text })
}
