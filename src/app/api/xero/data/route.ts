import { NextResponse } from 'next/server'
import { getToken, setToken } from '@/lib/token-store'
import { fetchAllXeroData } from '@/lib/xero-api'

export async function GET() {
  const xeroTokenData = getToken('xero')

  if (!xeroTokenData) {
    return NextResponse.json({ connected: false })
  }

  const result = await fetchAllXeroData(JSON.stringify(xeroTokenData))
  if (result.updatedTokenJson) {
    setToken('xero', JSON.parse(result.updatedTokenJson))
  }
  return NextResponse.json(result.data)
}
