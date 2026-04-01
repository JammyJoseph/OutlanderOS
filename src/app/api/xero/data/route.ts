import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { fetchAllXeroData } from '@/lib/xero-api'

export async function GET() {
  const cookieStore = await cookies()
  const tokenJson = cookieStore.get('xero_token')?.value

  if (!tokenJson) {
    return NextResponse.json({ connected: false })
  }

  const result = await fetchAllXeroData(tokenJson)
  const response = NextResponse.json(result.data)
  if (result.updatedTokenJson) {
    response.cookies.set('xero_token', result.updatedTokenJson, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    })
  }
  return response
}
