import { NextRequest, NextResponse } from 'next/server'
import { createOAuth2Client } from '@/lib/google-client'
import { setToken } from '@/lib/token-store'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') || 'primary'

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=no_code', request.url))
  }

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
