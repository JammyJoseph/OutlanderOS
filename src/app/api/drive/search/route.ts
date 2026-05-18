import { NextRequest, NextResponse } from 'next/server'
import { searchDriveForIO } from '@/lib/drive-search'
import { withAuth } from '@/lib/auth'

export const GET = withAuth(async (request: NextRequest) => {
  const client = request.nextUrl.searchParams.get('client') || ''
  const io = request.nextUrl.searchParams.get('io') || undefined
  if (!client) return NextResponse.json({ files: [] })
  const files = await searchDriveForIO(client, io)
  return NextResponse.json({ files })
})
