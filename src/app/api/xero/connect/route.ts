import { NextResponse } from 'next/server'
import { getXeroAuthUrl } from '@/lib/xero-client'

export async function GET() {
  try {
    const url = await getXeroAuthUrl()
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('Xero connect error:', err)
    return NextResponse.redirect(new URL('/settings?xero_error=connect_failed', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }
}
