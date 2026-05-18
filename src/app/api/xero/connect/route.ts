import { withErrorHandling } from "@/lib/api-error"
import { NextResponse } from 'next/server'
import { getXeroAuthUrl } from '@/lib/xero-client'
import { withAuth } from '@/lib/auth'

const GET__h = withAuth(async () => {
  try {
    const url = await getXeroAuthUrl()
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('Xero connect error:', err)
    return NextResponse.redirect(new URL('/settings?xero_error=connect_failed', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }
})

export const GET = withErrorHandling(GET__h as any)
