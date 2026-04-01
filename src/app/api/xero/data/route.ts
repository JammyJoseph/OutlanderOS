import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { fetchAllXeroData } from '@/lib/xero-api'

export async function GET() {
  const cookieStore = await cookies()
  const tokenJson = cookieStore.get('xero_token')?.value

  if (!tokenJson) {
    return NextResponse.json({ connected: false })
  }

  const data = await fetchAllXeroData(tokenJson)
  return NextResponse.json(data)
}
