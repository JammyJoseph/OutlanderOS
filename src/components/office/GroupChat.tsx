"use client"

import { useRef, useEffect, useState } from 'react'
import { Send, ArrowRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentStore, type ChatMessage } from '@/lib/agent-store'
import { AGENT_FLEET } from '@/lib/agents'

// Agent color map
const AGENT_COLORS: Record<string, string> = {
  operations: '#D4A853',
  finance: '#4ADE80',
  email: '#60A5FA',
  production: '#A78BFA',
  sales: '#F87171',
  content: '#F472B6',
}


function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono text-[#D4A853]">$1</code>')
}

function AgentDot({ agentId, size = 'sm' }: { agentId: string; size?: 'sm' | 'md' }) {
  const color = AGENT_COLORS[agentId] ?? '#888'
  const dim = size === 'md' ? 'h-7 w-7 text-xs' : 'h-5 w-5 text-[9px]'
  const name = AGENT_FLEET.find((a) => a.id === agentId)?.name ?? agentId
  return (
    <div
      className={cn('shrink-0 flex items-center justify-center rounded-full font-bold', dim)}
      style={{ backgroundColor: color + '22', border: `1.5px solid ${color}55`, color }}
    >
      {name[0]}
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const color = msg.agentId === 'user' ? undefined : AGENT_COLORS[msg.agentId as string]

  if (msg.type === 'system') {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] text-gray-500">
          {msg.content}
        </span>
      </div>
    )
  }

  if (msg.type === 'delegation') {
    const toAgent = AGENT_FLEET.find((a) => a.id === msg.delegateTo)
    const fromColor = AGENT_COLORS[msg.agentId as string] ?? '#888'
    const toColor = AGENT_COLORS[msg.delegateTo ?? ''] ?? '#888'
    return (
      <div className="flex items-center gap-2 py-0.5">
        <div className="h-px flex-1 bg-gray-200" />
        <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px]">
          <span style={{ color: fromColor }}>{msg.agentName}</span>
          <ArrowRight className="h-2.5 w-2.5 text-gray-400" />
          <span style={{ color: toColor }}>{toAgent?.name ?? msg.delegateTo}</span>
          <span className="text-gray-400">· {msg.content}</span>
        </div>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
    )
  }

  // User message
  if (msg.agentId === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%]">
          <div className="rounded-2xl rounded-br-sm bg-gray-100 px-4 py-2.5 text-sm text-gray-900 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          <p className="mt-1 text-right text-[10px] text-gray-400">{formatTime(msg.timestamp)}</p>
        </div>
      </div>
    )
  }

  // Agent message
  return (
    <div className="flex items-end gap-2">
      <AgentDot agentId={msg.agentId as string} size="md" />
      <div className="max-w-[75%]">
        <p className="mb-1 text-[11px] font-medium" style={{ color }}>{msg.agentName}</p>
        <div
          className="rounded-2xl rounded-bl-sm bg-gray-50 px-4 py-2.5 text-sm text-gray-900 leading-relaxed"
          style={{ borderLeft: `2px solid ${color}66` }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
        />
        <p className="mt-1 text-[10px] text-gray-400">{formatTime(msg.timestamp)}</p>
      </div>
    </div>
  )
}

interface GroupChatProps {
  selectedAgentId: string | null
}

export function GroupChat({ selectedAgentId }: GroupChatProps) {
  const { chatMessages, addMessage, updateAgentStatus, setActiveAgent, agents } = useAgentStore()
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const selectedAgent = selectedAgentId
    ? agents.find((a) => a.id === selectedAgentId) ?? null
    : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isTyping])

  async function handleSend() {
    const userMsg = input.trim()
    if (!userMsg) return
    setInput('')

    addMessage({ agentId: 'user', agentName: 'You', content: userMsg, type: 'message' })
    setIsTyping(true)

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      })
      const data = await res.json()

      setIsTyping(false)

      addMessage({ agentId: 'operations', agentName: 'Operations', content: data.operationsMessage, type: 'message' })

      if (data.delegatedTo) {
        const agentId = data.delegatedTo.toLowerCase()
        setTimeout(() => {
          addMessage({
            agentId: 'system',
            agentName: 'System',
            content: `Operations delegated to ${data.delegatedTo}`,
            type: 'delegation',
            delegateTo: agentId,
          })
        }, 500)

        updateAgentStatus(agentId, 'active')
        setTimeout(() => updateAgentStatus(agentId, 'idle'), 3000)
      }
    } catch {
      setIsTyping(false)
      addMessage({ agentId: 'operations', agentName: 'Operations', content: 'Failed to process — check API key configuration.', type: 'message' })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Team Channel</h2>
          <p className="text-[11px] text-gray-500">All agents · {AGENT_FLEET.length} members</p>
        </div>
        <div className="flex items-center gap-1">
          {AGENT_FLEET.map((a) => (
            <AgentDot key={a.id} agentId={a.id} />
          ))}
        </div>
      </div>

      {/* Selected agent overlay */}
      {selectedAgent && (
        <div
          className="mx-3 mt-3 flex items-center gap-3 rounded-lg border px-3 py-2"
          style={{
            borderColor: selectedAgent.color + '44',
            backgroundColor: selectedAgent.color + '0d',
          }}
        >
          <AgentDot agentId={selectedAgent.id} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: selectedAgent.color }}>
              {selectedAgent.name}
            </p>
            <p className="text-[11px] text-gray-500 truncate">{selectedAgent.role}</p>
            {selectedAgent.currentTask && (
              <p className="text-[10px] text-gray-400 truncate">{selectedAgent.currentTask}</p>
            )}
          </div>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
            style={{ backgroundColor: selectedAgent.color + '22', color: selectedAgent.color }}
          >
            {selectedAgent.status}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {chatMessages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isTyping && (
          <div className="flex items-end gap-2">
            <AgentDot agentId="operations" size="md" />
            <div
              className="rounded-2xl rounded-bl-sm bg-gray-50 px-4 py-3"
              style={{ borderLeft: '2px solid #D4A85366' }}
            >
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D4A853]/60 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D4A853]/60 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D4A853]/60 [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 focus-within:border-[#D4A853]/40 transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the team..."
            className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
            style={{ maxHeight: 100 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#D4A853] text-white transition-opacity disabled:opacity-30 hover:bg-[#C49843]"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1 text-center text-[10px] text-gray-400">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  )
}
