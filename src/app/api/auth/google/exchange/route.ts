import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import prisma from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { createUserOAuthClient } from '@/lib/google-user-auth'

// Exchanges an authorization code for access + refresh tokens and stores them
// on the signed-in user's record.
export const POST = withAuth(async (request: NextRequest, _ctx, user) => {
  let body: { code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const code = body.code?.trim()
  if (!code) {
    return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 })
  }

  try {
    const client = createUserOAuthClient()
    const { tokens } = await client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.json(
        {
          error:
            'Google did not return a refresh token. Remove OutlanderOS from your Google account permissions, then connect again.',
        },
        { status: 400 }
      )
    }

    // Identify which Google account was connected (gmail.readonly is enough).
    client.setCredentials({ access_token: tokens.access_token })
    const gmail = google.gmail({ version: 'v1', auth: client })
    const profile = await gmail.users.getProfile({ userId: 'me' })
    const email = profile.data.emailAddress || ''

    await prisma.user.update({
      where: { id: user.userId },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleEmail: email,
        googleConnected: true,
      },
    })

    return NextResponse.json({ success: true, email })
  } catch (err) {
    console.error('POST /api/auth/google/exchange', err)
    return NextResponse.json(
      {
        error:
          'Failed to exchange authorization code. It may have expired — start the connect flow again.',
      },
      { status: 400 }
    )
  }
})
