import fs from 'fs'
import path from 'path'

const CHAT_FILE = path.join(process.cwd(), '.chat-history.json')

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatMemory {
  conversations: ChatMessage[]
  learnedFacts: string[]
  lastUpdated: string
}

function readMemory(): ChatMemory {
  try {
    if (fs.existsSync(CHAT_FILE)) {
      return JSON.parse(fs.readFileSync(CHAT_FILE, 'utf-8'))
    }
  } catch (e) {
    console.error('Failed to read chat memory:', e)
  }
  return { conversations: [], learnedFacts: [], lastUpdated: new Date().toISOString() }
}

function writeMemory(memory: ChatMemory): void {
  try {
    memory.lastUpdated = new Date().toISOString()
    fs.writeFileSync(CHAT_FILE, JSON.stringify(memory, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to write chat memory:', e)
  }
}

export function addChatMessage(role: 'user' | 'assistant', content: string): void {
  const memory = readMemory()
  memory.conversations.push({ role, content, timestamp: new Date().toISOString() })
  if (memory.conversations.length > 100) {
    memory.conversations = memory.conversations.slice(-100)
  }
  writeMemory(memory)
}

export function getChatHistory(limit: number = 20): ChatMessage[] {
  const memory = readMemory()
  return memory.conversations.slice(-limit)
}

export function addLearnedFact(fact: string): void {
  const memory = readMemory()
  if (!memory.learnedFacts.includes(fact)) {
    memory.learnedFacts.push(fact)
    if (memory.learnedFacts.length > 50) {
      memory.learnedFacts = memory.learnedFacts.slice(-50)
    }
    writeMemory(memory)
  }
}

export function getLearnedFacts(): string[] {
  return readMemory().learnedFacts
}

export function clearChatHistory(): void {
  writeMemory({ conversations: [], learnedFacts: readMemory().learnedFacts, lastUpdated: new Date().toISOString() })
}
