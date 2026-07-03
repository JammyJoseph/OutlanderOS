'use client'

import { useEffect, useState } from 'react'
import { Check, AlertTriangle, Loader2, Mail } from 'lucide-react'

const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-[#ffd700] focus:ring-2 focus:ring-amber-200/60'

// Accepts either a raw authorization code or the full callback URL the user
// pasted from their browser, and returns just the code.
function extractCode(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/[?&]code=([^&\s]+)/)
  if (match) return decodeURIComponent(match[1])
  return trimmed
}

interface GoogleStatus {
  connected: boolean
  email: string | null
}

export function GoogleAccountSection() {
  const [status, setStatus] = useState<GoogleStatus | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function loadStatus() {
    try {
      const res = await fetch('/api/me')
      const json = await res.json()
      setStatus({
        connected: !!json.user?.googleConnected,
        email: json.user?.googleEmail ?? null,
      })
    } catch {
      setStatus({ connected: false, email: null })
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  async function startConnect() {
    setMessage(null)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/google/connect')
      const json = await res.json()
      if (!res.ok || !json.authUrl) {
        setMessage({ kind: 'err', text: json.error || 'Could not start Google connect' })
        return
      }
      window.open(json.authUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setBusy(false)
    }
  }

  async function submitCode() {
    setMessage(null)
    const code = extractCode(codeInput)
    if (!code) {
      setMessage({ kind: 'err', text: 'Paste your authorization code first' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/google/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setMessage({ kind: 'err', text: json.error || 'Failed to connect Google account' })
        return
      }
      setCodeInput('')
      setMessage({ kind: 'ok', text: `Connected ${json.email}` })
      await loadStatus()
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setMessage(null)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/google/disconnect', { method: 'POST' })
      if (!res.ok) {
        setMessage({ kind: 'err', text: 'Failed to disconnect' })
        return
      }
      setMessage({ kind: 'ok', text: 'Google account disconnected' })
      await loadStatus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 text-[#ffd700]">
          <Mail className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Google Account</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Connect your own Google account to enable email scanning, calendar
            sync, and smart deadline detection.
          </p>
        </div>
      </div>

      <div className="mt-5">
        {status === null ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking connection…
          </div>
        ) : status.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/30 p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {status.email || 'Google account'}
                </div>
                <div className="text-xs text-emerald-700 dark:text-emerald-300">Connected</div>
              </div>
            </div>
            <button
              onClick={disconnect}
              disabled={busy}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <ol className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
              <li>1. Click Connect Google Account — a Google consent screen opens in a new tab.</li>
              <li>2. Grant access. Google redirects you to a page showing an authorization code.</li>
              <li>3. Copy that code and paste it below, then click Finish connecting.</li>
            </ol>

            <button
              onClick={startConnect}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#ffd700] px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Connect Google Account
            </button>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Authorization code
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className={INPUT_CLS}
                  placeholder="Paste your authorization code here"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                />
                <button
                  onClick={submitCode}
                  disabled={busy}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  Finish connecting
                </button>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div
            className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              message.kind === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}
          >
            {message.kind === 'ok' ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {message.text}
          </div>
        )}
      </div>
    </section>
  )
}
