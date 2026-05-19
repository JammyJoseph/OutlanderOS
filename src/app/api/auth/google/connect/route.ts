import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { withAuth } from '@/lib/auth'
import { createUserOAuthClient, GOOGLE_USER_SCOPES } from '@/lib/google-user-auth'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'outlander-os-secret'

// Generates the Google OAuth consent URL for the signed-in user. The `state`
// is a short-lived JWT identifying who is connecting.
export const GET = withAuth(async (_request: NextRequest, _ctx, user) => {
  const state = jwt.sign({ userId: user.userId }, JWT_SECRET, { expiresIn: '1h' })

  const client = createUserOAuthClient()
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_USER_SCOPES,
    state,
  })

  return NextResponse.json({ authUrl })
})
