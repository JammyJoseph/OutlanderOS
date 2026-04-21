'use client'
import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, Loader2, Trash2 } from 'lucide-react'

declare global {
  interface WindowEventMap {
    openChatWithQuestion: CustomEvent<{ question: string }>
  }
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

const WELCOME = 'Hey. Ask me anything about the business — invoices, deals, revenue, team status. I have access to all your live data.'

export function FloatingChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: CustomEvent<{ question: string }>) => {
      setOpen(true)
      setInput(e.detail.question)
    }
    window.addEventListener('openChatWithQuestion', handler)
    return () => window.removeEventListener('openChatWithQuestion', handler)
  }, [])

  useEffect(() => {
    if (open && !historyLoaded) {
      fetch('/api/agent/history')
        .then(r => r.json())
        .then(data => {
          if (data.messages?.length) {
            setMessages(data.messages)
          } else {
            setMessages([{ role: 'assistant', content: WELCOME }])
          }
          setHistoryLoaded(true)
        })
        .catch(() => {
          setMessages([{ role: 'assistant', content: WELCOME }])
          setHistoryLoaded(true)
        })
    }
  }, [open, historyLoaded])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.operationsMessage || 'No response' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to connect. Check API key configuration.' }])
    }
    setLoading(false)
  }

  async function handleClear() {
    await fetch('/api/agent/history', { method: 'DELETE' })
    setMessages([{ role: 'assistant', content: WELCOME }])
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#D4A853] text-white rounded-2xl shadow-lg shadow-amber-200/60 hover:bg-[#C49843] hover:shadow-xl hover:shadow-amber-200/80 transition-all duration-200 flex items-center justify-center"
        title="Ask OutlanderOS"
      >
        <MessageCircle size={22} />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] bg-white flex flex-col overflow-hidden"
      style={{
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5" style={{ background: '#111' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="font-semibold text-sm text-white">OutlanderOS Agent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleClear}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-red-400 transition-colors"
            title="Clear history"
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!historyLoaded && (
          <div className="flex justify-center py-6">
            <Loader2 size={16} className="animate-spin text-gray-300" />
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[#D4A853] text-white rounded-2xl rounded-br-md'
                : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-md'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-3.5 py-2.5 text-gray-400 text-sm flex items-center gap-2 rounded-2xl rounded-bl-md">
              <Loader2 size={13} className="animate-spin" />
              <span>Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex gap-2 rounded-xl bg-gray-100 p-1.5">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask about invoices, deals, revenue…"
            className="flex-1 bg-transparent px-2 py-1 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D4A853] text-white disabled:opacity-40 transition-all duration-150 hover:bg-[#C49843]"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
