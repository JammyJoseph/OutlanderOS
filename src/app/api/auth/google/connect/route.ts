import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { signOAuthState } from '@/lib/oauth-state'
import {
  createUserOAuthClient,
  googleRedirectIsHosted,
  GOOGLE_USER_SCOPES,
} from '@/lib/google-user-auth'


// Generates the Google OAuth consent URL for the signed-in user. The `state`
// is a short-lived signed token identifying who is connecting — see oauth-state.ts.
export const GET = withAuth(async (_request: NextRequest, _ctx, user) => {
  const state = signOAuthState({ userId: user.userId })

  const client = createUserOAuthClient()
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_USER_SCOPES,
    state,
  })

  // `hosted` decides what the settings page asks of the user: with a registered
  // hosted redirect the connection completes itself, and asking anyone to copy
  // a code out of a URL bar would be theatre.
  return NextResponse.json({ authUrl, hosted: googleRedirectIsHosted() })
})
