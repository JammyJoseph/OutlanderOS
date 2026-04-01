import { NextRequest, NextResponse } from 'next/server'
import { createOAuth2Client } from '@/lib/google-client'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') || 'primary'

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=no_code', request.url))
  }

  try {
    const client = createOAuth2Client()
    const { tokens } = await client.getToken(code)

    const response = NextResponse.redirect(new URL('/settings?connected=' + state, request.url))
    response.cookies.set('google_' + state + '_token', JSON.stringify(tokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  } catch {
    return NextResponse.redirect(new URL('/settings?error=auth_failed', request.url))
  }
}
