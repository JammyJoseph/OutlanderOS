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
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#D4A853] text-white rounded-full shadow-lg hover:bg-[#C49843] transition-all flex items-center justify-center"
        title="Ask OutlanderOS"
      >
        <MessageCircle size={24} />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[500px] bg-white border border-gray-200 shadow-2xl flex flex-col overflow-hidden" style={{ borderRadius: '12px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="font-semibold text-sm">OutlanderOS Agent</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleClear} className="text-gray-400 hover:text-red-400 transition-colors" title="Clear history">
            <Trash2 size={14} />
          </button>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!historyLoaded && (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin text-gray-300" />
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-[#D4A853] text-white'
                : 'bg-gray-100 text-gray-800'
            }`} style={{ borderRadius: '8px' }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-3 py-2 text-gray-400 text-sm flex items-center gap-2" style={{ borderRadius: '8px' }}>
              <Loader2 size={14} className="animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask about invoices, deals, revenue..."
            className="flex-1 px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[#D4A853]"
            style={{ borderRadius: '6px' }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-[#D4A853] text-white disabled:opacity-50"
            style={{ borderRadius: '6px' }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
