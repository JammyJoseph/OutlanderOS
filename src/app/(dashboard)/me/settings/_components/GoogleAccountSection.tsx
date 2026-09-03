'use client'

import { useState } from 'react'
import { Check, AlertTriangle, Loader2, Mail } from 'lucide-react'
import { useUser } from '@/components/user-context'
import { useConfirm } from '@/components/ui/confirm-provider'
import { INPUT_CLS } from '@/lib/styles'

// Accepts either a raw authorization code or the full callback URL the user
// pasted from their browser, and returns just the code.
function extractCode(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/[?&]code=([^&\s]+)/)
  if (match) return decodeURIComponent(match[1])
  return trimmed
}

export function GoogleAccountSection() {
  // Connection state comes from the shared UserProvider (single /api/me fetch).
  const { user, loading: userLoading, refetch } = useUser()
  const confirm = useConfirm()
  const status = userLoading
    ? null
    : { connected: !!user?.googleConnected, email: user?.googleEmail ?? null }
  const [codeInput, setCodeInput] = useState('')
  // A connected account still needs a way to re-grant: scopes get added (Drive
  // read-write, then Sheets) and an old grant keeps working for everything
  // except the new thing, which fails with a 403 nobody can interpret. Without
  // this, the only route was Disconnect first — which throws away a working
  // refresh token before you know the new consent will succeed.
  const [reconnecting, setReconnecting] = useState(false)
  // Null until the first connect attempt tells us. True means Google will send
  // the user back to our own callback, which finishes the job — so there is no
  // code to paste and nothing to explain.
  const [hosted, setHosted] = useState<boolean | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function loadStatus() {
    await refetch()
  }

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
      setHosted(!!json.hosted)
      window.open(json.authUrl, '_blank', 'noopener,noreferrer')

      // Hosted flow: the callback writes the tokens itself, so watch for the
      // connection appearing rather than asking for a code. Gives up after two
      // minutes so a abandoned consent doesn't spin forever.
      if (json.hosted) {
        setWaiting(true)
        const started = Date.now()
        const poll = window.setInterval(async () => {
          await loadStatus()
          if (Date.now() - started > 120_000) {
            window.clearInterval(poll)
            setWaiting(false)
          }
        }, 3000)
      }
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
    const ok = await confirm({
      title: 'Disconnect Google account?',
      message:
        'Email scanning, calendar sync, and smart deadline detection will stop working until you reconnect.',
      confirmLabel: 'Disconnect',
      confirmVariant: 'danger',
    })
    if (!ok) return
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

  // Stop polling the moment the connection lands.
  if (waiting && status?.connected) setWaiting(false)

  // Used by both states, so the instructions can never drift apart.
  const connectSteps = (
    <div className="space-y-4">
      {hosted === false && (
        <ol className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
          <li>1. Click the button — a Google consent screen opens in a new tab.</li>
          <li>
            2. Grant access. Google then sends you to a <code>localhost</code> page that{' '}
            <strong>will not load</strong> — that is expected, not a failure.
          </li>
          <li>3. Copy the whole URL out of that page&rsquo;s address bar and paste it below.</li>
        </ol>
      )}
      {hosted === true && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Approve the permissions in the tab that opened. You&rsquo;ll come straight back here
          and this will say Connected — nothing to copy.
        </p>
      )}
      {waiting && (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for Google…
        </p>
      )}

      <button
        onClick={startConnect}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#111111] text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-semibold hover:brightness-95 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Open the Google consent screen
      </button>

      <div className={hosted === true ? 'hidden' : undefined}>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Paste the URL (or just the code)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={INPUT_CLS}
            placeholder="http://localhost:3000/api/google/callback?code=..."
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
  )

  return (
    <section className="mb-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 text-[#9C7C2E] dark:text-[#C9A44A]">
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setReconnecting(true)
                  void startConnect()
                }}
                disabled={busy}
                className="rounded-xl bg-[#111111] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50 dark:bg-white dark:text-black"
              >
                Reconnect
              </button>
              <button
                onClick={disconnect}
                disabled={busy}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          connectSteps
        )}

        {status?.connected && reconnecting && (
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
              Re-granting keeps you connected the whole way through — the existing connection
              stays live until the new one replaces it.
            </p>
            {connectSteps}
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
