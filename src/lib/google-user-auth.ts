import { google } from 'googleapis'
import prisma from '@/lib/prisma'

// Per-user Google OAuth. Each team member connects their own Google account;
// Gmail / Calendar / Drive access uses that individual's tokens.

// Where Google sends someone back to after they consent.
//
// The registered URI has always been http://localhost:3000/api/google/callback,
// from before this app had a hostname. A user's browser cannot reach localhost —
// the app runs on a remote box — so consent ends on a connection-refused page
// and the person has to copy the authorization code out of a broken URL bar.
// That is why connecting Google has always felt broken: it is.
//
// The cure is one line in Google Cloud Console, not code: add
// https://os.outlanderdirectory.com/api/google/callback to the OAuth client's
// authorised redirect URIs. Then set GOOGLE_REDIRECT_URI to it and consent
// lands back on our own callback, which already completes the connection on its
// own (see api/google/callback/route.ts).
//
// It is an env var rather than derived from NEXTAUTH_URL on purpose: a redirect
// URI Google doesn't recognise fails the whole flow with redirect_uri_mismatch,
// so the switch has to happen after the console entry exists, not on deploy.
export function googleUserRedirectUri(): string {
  const explicit = (process.env.GOOGLE_REDIRECT_URI ?? '').trim()
  return explicit || 'http://localhost:3000/api/google/callback'
}

/** True when consent will land back on us instead of a dead localhost page. */
export function googleRedirectIsHosted(): boolean {
  return !googleUserRedirectUri().includes('localhost')
}

export const GOOGLE_USER_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  // Read-write Drive: production file management (folder creation, upload, move
  // on approval, listing files uploaded directly to Drive) needs more than the
  // old drive.readonly scope. Users connected before this change must reconnect
  // — Google only grants the new scope on a fresh consent (prompt=consent).
  'https://www.googleapis.com/auth/drive',
  // Sheets is its own scope: the Sheets API answers 403 "insufficient
  // authentication scopes" to a token holding only auth/drive, however broad
  // that sounds. Needed for the live credit sheet the print designer works
  // from. Anyone connected before this line must reconnect — and as of
  // 2026-09-03 every existing grant was still on the pre-upgrade
  // `drive.readonly` anyway, so nobody loses anything by reconnecting once.
  'https://www.googleapis.com/auth/spreadsheets',
]

export function createUserOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    googleUserRedirectUri()
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
