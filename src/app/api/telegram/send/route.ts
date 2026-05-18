import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'
import { withAuth } from '@/lib/auth'
import { sanitizeString } from '@/lib/validate'

const POST__h = withAuth(async (request: NextRequest) => {
  const body = await request.json()
  const message = sanitizeString(body?.message, 4000)
  if (!message) return NextResponse.json({ error: 'No message' }, { status: 400 })
  const ok = await sendTelegramMessage(message)
  return NextResponse.json({ ok })
})

export const POST = withErrorHandling(POST__h as any)
