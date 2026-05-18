import { withErrorHandling } from "@/lib/api-error"
import { NextResponse } from 'next/server'
import { getToken, setToken } from '@/lib/token-store'
import { fetchAllXeroData } from '@/lib/xero-api'
import { withAuth } from '@/lib/auth'

const GET__h = withAuth(async () => {
  const xeroTokenData = getToken('xero')

  if (!xeroTokenData) {
    return NextResponse.json({ connected: false })
  }

  const result = await fetchAllXeroData(JSON.stringify(xeroTokenData))
  if (result.updatedTokenJson) {
    setToken('xero', JSON.parse(result.updatedTokenJson))
  }
  return NextResponse.json(result.data)
})

export const GET = withErrorHandling(GET__h as any)
