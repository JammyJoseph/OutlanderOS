import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  const { message } = await request.json()
  if (!message) return NextResponse.json({ error: 'No message' }, { status: 400 })
  const ok = await sendTelegramMessage(message)
  return NextResponse.json({ ok })
}
