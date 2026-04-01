'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2, Mail, RefreshCw } from 'lucide-react'

interface Email {
  id: string | null | undefined
  from: string
  subject: string
  date: string
  snippet: string
  unread: boolean
}

interface EmailData {
  unreadCount: number
  recentEmails: Email[]
  error?: string
}

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  emails?: EmailData
}

function senderName(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : from.replace(/<[^>]+>/, '').trim()
}

function senderEmail(from: string) {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1] : from
}

function formatDate(raw: string) {
  if (!raw) return ''
  try {
    return new Date(raw).toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return raw
  }
}

export default function EmailPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Email | null>(null)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: DashboardData = await res.json()
      setData(json)
      setError(null)
      // Auto-select first email
      if (json.emails?.recentEmails?.length && !selected) {
        setSelected(json.emails.recentEmails[0])
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading emails…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-400" />
          <p className="text-sm text-zinc-300">{error}</p>
          <button onClick={() => load()} className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data?.connected.billing) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <Mail className="mx-auto mb-3 h-6 w-6 text-zinc-600" />
          <p className="text-sm font-medium text-zinc-400">Billing account not connected</p>
          <p className="mt-1 text-xs text-zinc-600">Connect billing@outlandermag.com to view emails.</p>
          <a
            href="/api/google/connect?label=billing"
            className="mt-4 inline-block rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-[#C49843] transition-colors"
          >
            Connect billing@
          </a>
        </div>
      </div>
    )
  }

  const emails = data.emails

  if (emails?.error) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-400" />
          <p className="text-sm font-medium text-zinc-300">Failed to load emails</p>
          <p className="mt-1 text-xs text-zinc-500">{emails.error}</p>
          <button onClick={() => load()} className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const emailList = emails?.recentEmails ?? []

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-200">billing@outlandermag.com</span>
          {emails && emails.unreadCount > 0 && (
            <span className="rounded-full bg-[#D4A853] px-1.5 py-0.5 text-[10px] font-bold text-zinc-900">
              {emails.unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Email list */}
        <div className="w-72 shrink-0 overflow-y-auto border-r border-zinc-800">
          {emailList.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-500">No emails found.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {emailList.map(email => (
                <button
                  key={email.id}
                  onClick={() => setSelected(email)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-zinc-800/50 ${
                    selected?.id === email.id ? 'bg-zinc-800' : ''
                  } ${email.unread ? 'bg-zinc-900' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`text-sm truncate ${email.unread ? 'font-semibold text-white' : 'text-zinc-300'}`}>
                      {senderName(email.from)}
                    </span>
                    {email.unread && <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4A853]" />}
                  </div>
                  <p className={`text-xs truncate ${email.unread ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {email.subject || '(no subject)'}
                  </p>
                  <p className="text-xs text-zinc-600 truncate mt-0.5">{email.snippet}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail pane */}
        <div className="flex-1 overflow-y-auto p-6">
          {selected ? (
            <div className="max-w-2xl space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{selected.subject || '(no subject)'}</h2>
                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                  <p><span className="text-zinc-400">From:</span> {senderName(selected.from)} &lt;{senderEmail(selected.from)}&gt;</p>
                  <p><span className="text-zinc-400">Date:</span> {formatDate(selected.date)}</p>
                </div>
              </div>
              <div className="h-px bg-zinc-800" />
              <p className="text-sm leading-relaxed text-zinc-300">{selected.snippet}</p>
              <p className="text-xs text-zinc-600 italic">
                Showing email preview. Full email body requires message-level API access.
              </p>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-600">Select an email to read</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
