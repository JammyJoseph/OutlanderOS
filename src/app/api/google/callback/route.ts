import { NextRequest, NextResponse } from 'next/server'
import { sealOptional } from '@/lib/secret-box'
import { google } from 'googleapis'
import prisma from '@/lib/prisma'
import { createOAuth2Client } from '@/lib/google-client'
import { createUserOAuthClient } from '@/lib/google-user-auth'
import { setToken } from '@/lib/token-store'
import { getCurrentUser } from '@/lib/current-user'
import { readOAuthState } from '@/lib/oauth-state'


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

// Single Google OAuth callback for both flows. `state` is always a signed token
// from oauth-state.ts naming who started the flow:
//  - Shared account (`state.account` set, e.g. "primary"): tokens go to the
//    shared token store. Admins only.
//  - Per-user (no account): tokens are stored on that user's record.
//
// Either way the browser finishing the flow must be signed in as the person who
// started it. This route used to accept a bare label from anyone, signed in or
// not, so any Google code for this app could overwrite the shared account.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = readOAuthState(request.nextUrl.searchParams.get('state'))
  const failed = state?.account ? '/admin/settings?error=auth_failed' : '/me/settings?google_error=bad_state'

  if (!code) {
    return back(state?.account ? '/admin/settings?error=no_code' : '/me/settings?google_error=no_code')
  }

  const viewer = await getCurrentUser(request)
  if (!state || !viewer || viewer.userId !== state.userId) return back(failed)

  if (!state.account) {
    const userId = state.userId
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
          googleAccessToken: sealOptional(tokens.access_token),
          googleRefreshToken: sealOptional(tokens.refresh_token),
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

  // Shared-account flow. Role is read from the database by getCurrentUser, so an
  // admin demoted since starting the flow is refused here.
  if (viewer.role !== 'ADMIN') return back(failed)
  const account = state.account
  try {
    const client = createOAuth2Client()
    const { tokens } = await client.getToken(code)

    setToken('google_' + account, {
      ...tokens,
      expires_at: Date.now() + (tokens.expiry_date ? tokens.expiry_date - Date.now() : 3600000),
      connected_email: account,
      connected_at: new Date().toISOString(),
    })

    const response = back('/admin/settings?connected=' + encodeURIComponent(account))
    response.cookies.set('google_' + account + '_token', 'connected', {
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  } catch {
    return back('/admin/settings?error=auth_failed')
  }
}
