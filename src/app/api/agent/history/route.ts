import { NextResponse } from 'next/server'
import { getChatHistory, getLearnedFacts, clearChatHistory } from '@/lib/chat-memory'
import { withAuth } from '@/lib/auth'

export const GET = withAuth(async () => {
  const messages = getChatHistory(50)
  const facts = getLearnedFacts()
  return NextResponse.json({ messages, facts })
})

export const DELETE = withAuth(async () => {
  clearChatHistory()
  return NextResponse.json({ ok: true })
})
