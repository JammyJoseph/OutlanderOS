import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from "@/lib/jwt-secret"
import { google } from 'googleapis'
import prisma from '@/lib/prisma'
import { createOAuth2Client } from '@/lib/google-client'
import { createUserOAuthClient } from '@/lib/google-user-auth'
import { setToken } from '@/lib/token-store'


// Redirects here are RELATIVE on purpose.
//
// NextResponse.redirect(new URL(path, request.url)) looked right and sent
// people to https://localhost:3000 — behind nginx, `request.url` resolves to
// the address the app is listening on, not the hostname the browser asked for.
// The tokens were already stored by then, so the only symptom was a browser
// error page at the end of a successful connection: the worst kind of bug,
// because it says "broken" when it means "done".
//
// A relative Location is resolved by the browser against the URL it actually
// requested, which is always the right host — the same reason the login bounces
// in proxy.ts have never had this problem.
function back(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } })
}

// Single Google OAuth callback for both flows:
//  - App-level: `state` is an account label (e.g. "primary"); tokens go to the
//    shared token store.
//  - Per-user: `state` is a short-lived JWT carrying the signed-in user's id
//    (minted by /api/auth/google/connect); tokens are stored on that user's
//    record. Per-user redirects normally land on an unreachable localhost page
//    where the user copies the code manually, but if this handler is reached
//    with a valid JWT state it completes the connection directly.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') || 'primary'

  if (!code) {
    return back('/me/settings?google_error=no_code')
  }

  // Per-user flow: a valid JWT state identifies who is connecting.
  let userId: string | null = null
  try {
    const decoded = jwt.verify(state, getJwtSecret()) as { userId?: string }
    if (decoded?.userId) userId = decoded.userId
  } catch {
    // Not a per-user JWT — treat as an app-level account label below.
  }

  if (userId) {
    try {
      const client = createUserOAuthClient()
      const { tokens } = await client.getToken(code)

      if (!tokens.access_token || !tokens.refresh_token) {
        return back('/me/settings?google_error=no_refresh_token')
      }

      // Identify which Google account was connected.
      client.setCredentials({ access_token: tokens.access_token })
      const gmail = google.gmail({ version: 'v1', auth: client })
      const profile = await gmail.users.getProfile({ userId: 'me' })

      await prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token,
          googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          googleEmail: profile.data.emailAddress || '',
          googleConnected: true,
        },
      })

      return back('/me/settings?google_connected=1')
    } catch (err) {
      console.error('GET /api/google/callback (per-user)', err)
      return back('/me/settings?google_error=exchange_failed')
    }
  }

  // App-level flow.
  try {
    const client = createOAuth2Client()
    const { tokens } = await client.getToken(code)

    setToken('google_' + state, {
      ...tokens,
      expires_at: Date.now() + (tokens.expiry_date ? tokens.expiry_date - Date.now() : 3600000),
      connected_email: state,
      connected_at: new Date().toISOString(),
    })

    const response = back('/admin/settings?connected=' + encodeURIComponent(state))
    response.cookies.set('google_' + state + '_token', 'connected', {
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  } catch {
    return back('/admin/settings?error=auth_failed')
  }
}
