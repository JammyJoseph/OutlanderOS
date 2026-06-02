import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { google } from 'googleapis'
import prisma from '@/lib/prisma'
import { createOAuth2Client } from '@/lib/google-client'
import { createUserOAuthClient } from '@/lib/google-user-auth'
import { setToken } from '@/lib/token-store'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'outlander-os-secret'

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
    return NextResponse.redirect(new URL('/settings?error=no_code', request.url))
  }

  // Per-user flow: a valid JWT state identifies who is connecting.
  let userId: string | null = null
  try {
    const decoded = jwt.verify(state, JWT_SECRET) as { userId?: string }
    if (decoded?.userId) userId = decoded.userId
  } catch {
    // Not a per-user JWT — treat as an app-level account label below.
  }

  if (userId) {
    try {
      const client = createUserOAuthClient()
      const { tokens } = await client.getToken(code)

      if (!tokens.access_token || !tokens.refresh_token) {
        return NextResponse.redirect(
          new URL('/me/settings?google_error=no_refresh_token', request.url)
        )
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

      return NextResponse.redirect(new URL('/me/settings?google_connected=1', request.url))
    } catch (err) {
      console.error('GET /api/google/callback (per-user)', err)
      return NextResponse.redirect(
        new URL('/me/settings?google_error=exchange_failed', request.url)
      )
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

    const response = NextResponse.redirect(new URL('/settings?connected=' + state, request.url))
    response.cookies.set('google_' + state + '_token', 'connected', {
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  } catch {
    return NextResponse.redirect(new URL('/settings?error=auth_failed', request.url))
  }
}
