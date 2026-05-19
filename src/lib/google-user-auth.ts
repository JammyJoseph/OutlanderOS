import { google } from 'googleapis'
import prisma from '@/lib/prisma'

// Per-user Google OAuth. Each team member connects their own Google account;
// Gmail / Calendar / Drive access uses that individual's tokens.

// The app runs on a bare IP, so we use a localhost redirect URI (already
// authorised in the Google Cloud Console). Google bounces the browser to a
// "connection refused" page and the user copies the code back into the app.
export const GOOGLE_USER_REDIRECT_URI = 'http://localhost:3000/auth/google/callback'

export const GOOGLE_USER_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
]

export function createUserOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_USER_REDIRECT_URI
  )
}

export interface UserGoogleTokens {
  accessToken: string
  refreshToken: string
  expiry: Date
}

// Exchanges a refresh token for a fresh access token via Google's token endpoint.
export async function refreshGoogleToken(
  refreshToken: string
): Promise<{ accessToken: string; expiry: Date }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  return {
    accessToken: data.access_token,
    expiry: new Date(Date.now() + data.expires_in * 1000),
  }
}

// Returns valid Google tokens for a user, auto-refreshing the access token when
// it has expired. Returns null when the user has not connected Google.
export async function getUserGoogleTokens(userId: string): Promise<UserGoogleTokens | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
      googleConnected: true,
    },
  })

  if (!user?.googleConnected || !user.googleRefreshToken) return null

  const expiry = user.googleTokenExpiry
  const stillValid =
    !!user.googleAccessToken && !!expiry && expiry.getTime() - 60_000 > Date.now()

  if (stillValid) {
    return {
      accessToken: user.googleAccessToken as string,
      refreshToken: user.googleRefreshToken,
      expiry: expiry as Date,
    }
  }

  const refreshed = await refreshGoogleToken(user.googleRefreshToken)
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: refreshed.accessToken,
      googleTokenExpiry: refreshed.expiry,
    },
  })

  return {
    accessToken: refreshed.accessToken,
    refreshToken: user.googleRefreshToken,
    expiry: refreshed.expiry,
  }
}

// Fetches Gmail messages using the user's personal token. Returns the
// authenticated gmail client alongside the message list so callers can fetch
// individual messages. Returns null when the user has not connected Google.
export async function getUserGmail(userId: string, query?: string, maxResults = 50) {
  const tokens = await getUserGoogleTokens(userId)
  if (!tokens) return null

  const client = createUserOAuthClient()
  client.setCredentials({ access_token: tokens.accessToken })
  const gmail = google.gmail({ version: 'v1', auth: client })

  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: query || undefined,
  })

  return { gmail, messages: res.data.messages || [] }
}
