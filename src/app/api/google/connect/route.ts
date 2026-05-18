import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google-client'
import { withAuth } from '@/lib/auth'

const GET__h = withAuth(async (request: NextRequest) => {
  const label = request.nextUrl.searchParams.get('label') || 'primary'
  const url = getAuthUrl(label)
  return NextResponse.redirect(url)
})

export const GET = withErrorHandling(GET__h as any)
