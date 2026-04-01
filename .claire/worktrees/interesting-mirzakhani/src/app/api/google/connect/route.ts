import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google-client'

export async function GET(request: NextRequest) {
  const label = request.nextUrl.searchParams.get('label') || 'primary'
  const url = getAuthUrl(label)
  return NextResponse.redirect(url)
}
