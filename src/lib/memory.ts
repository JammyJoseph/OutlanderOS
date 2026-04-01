interface Memory {
  id: string
  type: 'observation' | 'learning' | 'task' | 'contact' | 'pattern'
  content: string
  source: string // which integration this came from
  timestamp: Date
  tags: string[]
  importance: number // 1-10
}

// For now, store in-memory (will move to database later)
let memories: Memory[] = []

export function addMemory(memory: Omit<Memory, 'id' | 'timestamp'>) {
  memories.push({
    ...memory,
    id: crypto.randomUUID(),
    timestamp: new Date(),
  })
}

export function searchMemories(query: string, type?: Memory['type']) {
  return memories.filter(m => {
    const matchesQuery = m.content.toLowerCase().includes(query.toLowerCase()) ||
      m.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
    const matchesType = type ? m.type === type : true
    return matchesQuery && matchesType
  })
}

export function getRecentMemories(limit = 50) {
  return [...memories].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit)
}

export function getMemoriesByType(type: Memory['type']) {
  return memories.filter(m => m.type === type)
}
