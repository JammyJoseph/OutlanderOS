import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from "@/lib/jwt-secret"
import { withAuth } from '@/lib/auth'
import {
  createUserOAuthClient,
  googleRedirectIsHosted,
  GOOGLE_USER_SCOPES,
} from '@/lib/google-user-auth'


// Generates the Google OAuth consent URL for the signed-in user. The `state`
// is a short-lived JWT identifying who is connecting.
export const GET = withAuth(async (_request: NextRequest, _ctx, user) => {
  const state = jwt.sign({ userId: user.userId }, getJwtSecret(), { expiresIn: '1h' })

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
