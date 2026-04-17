import { NextResponse } from 'next/server'
import { getChatHistory, getLearnedFacts, clearChatHistory } from '@/lib/chat-memory'

export async function GET() {
  const messages = getChatHistory(50)
  const facts = getLearnedFacts()
  return NextResponse.json({ messages, facts })
}

export async function DELETE() {
  clearChatHistory()
  return NextResponse.json({ ok: true })
}
