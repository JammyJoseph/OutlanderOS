"use client"

import { useState } from 'react'
import { X, Zap, ChevronRight, Send, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Agent } from '@/lib/agents'

interface Message {
  role: 'user' | 'agent'
  text: string
}

interface AgentPanelProps {
  agent: Agent
  onClose: () => void
  onAssignTask: () => void
}

export function AgentPanel({ agent, onClose, onAssignTask }: AgentPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'agent', text: `Hi, I'm the ${agent.name} Agent. How can I help?` }
  ])
  const [input, setInput] = useState('')

  const statusLabel =
    agent.status === 'active' ? 'Active' :
    agent.status === 'thinking' ? 'Thinking' :
    agent.status === 'offline' ? 'Offline' : 'Idle'

  const statusColor =
    agent.status === 'active' ? 'text-green-400' :
    agent.status === 'thinking' ? 'text-[#D4A853]' :
    agent.status === 'offline' ? 'text-neutral-500' :
    'text-neutral-500'

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg: Message = { role: 'user', text: input }
    const agentReply: Message = {
      role: 'agent',
      text: `I've noted your request. I'll get on "${input.trim()}" right away.`
    }
    setMessages(prev => [...prev, userMsg, agentReply])
    setInput('')
  }

  return (
    <div className="flex h-full w-80 flex-col border-l border-neutral-800 bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold"
            style={{ backgroundColor: agent.color + '22', color: agent.color }}
          >
            {agent.name[0]}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{agent.name}</div>
            <div className="text-xs text-neutral-500">{agent.role}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Status + task */}
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Circle className={cn('h-2 w-2 fill-current', statusColor)} />
          <span className={cn('text-xs font-medium', statusColor)}>{statusLabel}</span>
        </div>
        {agent.currentTask && (
          <div className="mt-2 rounded bg-neutral-900 px-3 py-2 text-xs text-neutral-300">
            <span className="text-neutral-500">Current: </span>
            {agent.currentTask}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="border-b border-neutral-800 px-4 py-3">
        <p className="text-xs leading-relaxed text-neutral-400">{agent.description}</p>
      </div>

      {/* Capabilities */}
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Capabilities
        </div>
        <div className="flex flex-wrap gap-1.5">
          {agent.capabilities.map((cap) => (
            <span
              key={cap}
              className="rounded-full px-2 py-0.5 text-xs"
              style={{ backgroundColor: agent.color + '18', color: agent.color }}
            >
              {cap}
            </span>
          ))}
        </div>
      </div>

      {/* Assign task button */}
      <div className="border-b border-neutral-800 px-4 py-3">
        <button
          onClick={onAssignTask}
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: agent.color + '22', color: agent.color }}
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Assign Task
          </div>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'rounded-lg px-3 py-2 text-xs max-w-[85%]',
                msg.role === 'user'
                  ? 'ml-auto bg-neutral-800 text-white'
                  : 'mr-auto text-neutral-300'
              )}
              style={
                msg.role === 'agent'
                  ? { backgroundColor: agent.color + '15', borderLeft: `2px solid ${agent.color}` }
                  : {}
              }
            >
              {msg.text}
            </div>
          ))}
        </div>

        <div className="border-t border-neutral-800 p-3">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-xs text-white outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-700"
              placeholder={`Message ${agent.name}…`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={handleSend}
              className="rounded-md p-2 transition-colors hover:opacity-80"
              style={{ backgroundColor: agent.color + '33', color: agent.color }}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
