import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google-client'
import { withAuth } from '@/lib/auth'

export const GET = withAuth(async (request: NextRequest) => {
  const label = request.nextUrl.searchParams.get('label') || 'primary'
  const url = getAuthUrl(label)
  return NextResponse.redirect(url)
})
