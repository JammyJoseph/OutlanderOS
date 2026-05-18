import { withErrorHandling } from "@/lib/api-error"
import { NextResponse } from 'next/server'

async function POST__inner() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('auth_token')
  return response
}

export const POST = withErrorHandling(POST__inner as any)
