import { withErrorHandling } from "@/lib/api-error"
import { NextResponse } from 'next/server'
import { getChatHistory, getLearnedFacts, clearChatHistory } from '@/lib/chat-memory'
import { withAuth } from '@/lib/auth'

const GET__h = withAuth(async () => {
  const messages = getChatHistory(50)
  const facts = getLearnedFacts()
  return NextResponse.json({ messages, facts })
})

const DELETE__h = withAuth(async () => {
  clearChatHistory()
  return NextResponse.json({ ok: true })
})

export const GET = withErrorHandling(GET__h as any)
export const DELETE = withErrorHandling(DELETE__h as any)
