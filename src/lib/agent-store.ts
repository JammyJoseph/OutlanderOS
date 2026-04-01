import { create } from 'zustand'
import { Agent, AGENT_FLEET } from './agents'

export interface ChatMessage {
  id: string
  agentId: string | 'user' | 'system'
  agentName: string
  content: string
  timestamp: Date
  type: 'message' | 'delegation' | 'system'
  delegateTo?: string
}

interface AgentStore {
  agents: Agent[]
  activeAgentId: string | null
  selectedAgentId: string | null
  chatMessages: ChatMessage[]
  setActiveAgent: (id: string | null) => void
  setSelectedAgent: (id: string | null) => void
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  updateAgentStatus: (id: string, status: Agent['status']) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: AGENT_FLEET.map((a) => ({ ...a })),
  activeAgentId: null,
  selectedAgentId: null,
  chatMessages: [
    {
      id: '1',
      agentId: 'operations',
      agentName: 'Operations',
      content:
        "Morning. All systems nominal. I'm monitoring billing@, q@ calendar, and the billing tracker. What would you like me to focus on today?",
      timestamp: new Date(),
      type: 'message',
    },
  ],
  setActiveAgent: (id) => set({ activeAgentId: id }),
  setSelectedAgent: (id) => set({ selectedAgentId: id }),
  addMessage: (message) =>
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
      ],
    })),
  updateAgentStatus: (id, status) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, status } : a)),
    })),
}))
