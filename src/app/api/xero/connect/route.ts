import { NextResponse } from 'next/server'
import { getXeroAuthUrl } from '@/lib/xero-client'
import { withAuth } from '@/lib/auth'

export const GET = withAuth(async () => {
  try {
    const url = await getXeroAuthUrl()
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('Xero connect error:', err)
    return NextResponse.redirect(new URL('/settings?xero_error=connect_failed', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }
})
