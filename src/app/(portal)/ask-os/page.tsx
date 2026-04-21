'use client'

import { useState, useEffect, useRef } from 'react'
import { Bot, Send, Loader2, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderMarkdown(raw: string): string {
  const codeBlocks: string[] = []
  let text = raw.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    const idx = codeBlocks.length
    codeBlocks.push(code)
    return `\x00CODE${idx}\x00`
  })

  text = escapeHtml(text)
  text = text.replace(/`([^`\n]+)`/g, '<code style="background:#f3f4f6;border-radius:3px;padding:1px 5px;font-size:0.85em;font-family:monospace">$1</code>')
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  text = text.replace(/^### (.+)$/gm, '<h3 style="font-weight:600;margin:10px 0 3px">$1</h3>')
  text = text.replace(/^## (.+)$/gm, '<h2 style="font-weight:700;font-size:1.05em;margin:14px 0 4px">$1</h2>')
  text = text.replace(/^# (.+)$/gm, '<h1 style="font-weight:700;font-size:1.1em;margin:16px 0 6px">$1</h1>')
  text = text.replace(/^[-•] (.+)$/gm, '<li style="margin-left:18px;list-style-type:disc">$1</li>')
  text = text.replace(/\n/g, '<br/>')

  codeBlocks.forEach((code, idx) => {
    const esc = escapeHtml(code)
    text = text.replace(`\x00CODE${idx}\x00`, `<pre style="background:#1e293b;color:#e2e8f0;border-radius:8px;padding:12px 14px;overflow-x:auto;margin:8px 0;font-size:0.8em;font-family:monospace;white-space:pre"><code>${esc}</code></pre>`)
  })

  return text
}

function getTopics(messages: ChatMessage[]): string[] {
  return messages
    .filter(m => m.role === 'user')
    .slice(-8)
    .reverse()
    .map(m => (m.content.length > 46 ? m.content.slice(0, 46) + '…' : m.content))
}

export default function AskOSPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [facts, setFacts] = useState<string[]>([])
  const [factsOpen, setFactsOpen] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/agent/history')
      .then(r => r.json())
      .then(data => {
        if (data.messages?.length) setMessages(data.messages)
        if (data.facts?.length) setFacts(data.facts)
        setHistoryLoaded(true)
      })
      .catch(() => setHistoryLoaded(true))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: messages.length > 3 ? 'smooth' : 'auto' })
  }, [messages, loading])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date().toISOString() }])
    setLoading(true)

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.operationsMessage || 'No response', timestamp: new Date().toISOString() }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection failed. Check API configuration.', timestamp: new Date().toISOString() }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  async function clearConversation() {
    await fetch('/api/agent/history', { method: 'DELETE' })
    setMessages([])
    setFacts([])
  }

  const topics = getTopics(messages)

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-[#D4A853]" />
          <span className="text-sm font-semibold text-gray-900">Ask OS</span>
          <div className="h-2 w-2 rounded-full bg-green-400" title="Online" />
        </div>
        <button onClick={clearConversation} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={12} />
          Clear Conversation
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-gray-100 bg-gray-50">
          <div className="flex-1 overflow-y-auto p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Recent</p>
            {topics.length === 0 ? (
              <p className="text-xs text-gray-400">{historyLoaded ? 'No conversations yet' : 'Loading…'}</p>
            ) : (
              <ul className="space-y-0.5">
                {topics.map((t, i) => (
                  <li key={i} className="cursor-default truncate rounded px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100" title={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-gray-200 p-3">
            <button onClick={() => setFactsOpen(o => !o)} className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600">
              Learned Facts
              {factsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {factsOpen && (
              <ul className="mt-2 space-y-1">
                {facts.length === 0 ? (
                  <li className="text-xs text-gray-400">Nothing noted yet</li>
                ) : (
                  facts.map((f, i) => <li key={i} className="text-xs text-gray-600 leading-snug">• {f}</li>)
                )}
              </ul>
            )}
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {messages.length === 0 && historyLoaded && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Bot className="h-14 w-14 text-gray-100 mb-4" />
                <p className="text-gray-500 text-sm font-medium">Ask me anything about the business</p>
                <p className="text-gray-300 text-xs mt-1">Invoices · Deals · Revenue · Team status</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 mt-0.5">
                    <Bot size={13} className="text-[#D4A853]" />
                  </div>
                )}
                {msg.role === 'user' ? (
                  <div className="max-w-[60%] rounded-2xl bg-[#D4A853] px-4 py-3 text-sm text-white">{msg.content}</div>
                ) : (
                  <div className="max-w-[75%] rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 mt-0.5">
                  <Bot size={13} className="text-[#D4A853]" />
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin" /> Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gray-100 bg-white px-6 py-4">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 focus-within:border-[#D4A853] transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask about invoices, deals, revenue…"
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              />
              <button onClick={send} disabled={loading || !input.trim()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#D4A853] text-white disabled:opacity-40 hover:bg-[#C49843] transition-colors">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
