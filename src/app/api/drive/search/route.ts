import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import { searchDriveForIO } from '@/lib/drive-search'
import { withAuth } from '@/lib/auth'

const GET__h = withAuth(async (request: NextRequest) => {
  const client = request.nextUrl.searchParams.get('client') || ''
  const io = request.nextUrl.searchParams.get('io') || undefined
  if (!client) return NextResponse.json({ files: [] })
  const files = await searchDriveForIO(client, io)
  return NextResponse.json({ files })
})

export const GET = withErrorHandling(GET__h as any)
