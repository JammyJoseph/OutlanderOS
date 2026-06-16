'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, AlertTriangle } from 'lucide-react'

export default function GoogleCallbackPage() {
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    const c = params.get('code')
    if (err) setError(err)
    else if (c) setCode(c)
    else setError('No authorization code was returned.')
  }, [])

  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — user can still select manually */
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#141414] px-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">
          Outlander<span className="text-[#ffd700]">OS</span>
        </h1>

        {error ? (
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>Authorization failed: {error}. Please start the connect flow again.</span>
          </div>
        ) : code ? (
          <>
            <p className="mt-4 text-sm text-gray-600">
              Your authorization code is ready. Copy it and paste it into the
              Google Account section of OutlanderOS settings.
            </p>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Authorization code
              </label>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-800">
                  {code}
                </code>
                <button
                  onClick={copyCode}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#ffd700] px-3 py-2 text-sm font-semibold text-black hover:brightness-95"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Go to OutlanderOS → Settings → Google Account and paste this code
              to finish connecting your account.
            </p>
          </>
        ) : (
          <p className="mt-5 text-sm text-gray-500">Reading authorization code…</p>
        )}
      </div>
    </div>
  )
}
