import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import { handleXeroCallback } from '@/lib/xero-client'
import { setToken } from '@/lib/token-store'

async function GET__inner(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/settings?xero_error=no_code', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }

  try {
    const rawTokenJson = await handleXeroCallback(code)
    const tokenData = JSON.parse(rawTokenJson)
    tokenData.expires_at = Date.now() + ((tokenData.expires_in || 1800) * 1000)
    tokenData.connected_at = new Date().toISOString()

    setToken('xero', tokenData)

    const response = NextResponse.redirect(
      new URL('/settings?xero_connected=true', process.env.NEXTAUTH_URL || 'http://localhost:3000')
    )
    response.cookies.set('xero_token', 'connected', {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('Xero callback error:', err)
    return NextResponse.redirect(new URL('/settings?xero_error=callback_failed', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }
}

export const GET = withErrorHandling(GET__inner as any)
