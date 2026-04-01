import { NextRequest, NextResponse } from 'next/server'
import { handleXeroCallback } from '@/lib/xero-client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/settings?xero_error=no_code', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }

  try {
    const tokenJson = await handleXeroCallback(code)
    const response = NextResponse.redirect(
      new URL('/settings?xero_connected=true', process.env.NEXTAUTH_URL || 'http://localhost:3000')
    )
    response.cookies.set('xero_token', tokenJson, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })
    return response
  } catch (err) {
    console.error('Xero callback error:', err)
    return NextResponse.redirect(new URL('/settings?xero_error=callback_failed', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }
}
