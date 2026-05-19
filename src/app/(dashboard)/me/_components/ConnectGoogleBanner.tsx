'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, X } from 'lucide-react'

const DISMISS_KEY = 'outlanderos.googleBannerDismissed'

// Prompts the user to connect their personal Google account. Dismissible for
// the current session, but reappears next visit until Google is connected.
export function ConnectGoogleBanner() {
  const router = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return
    fetch('/api/me')
      .then((res) => res.json())
      .then((json) => {
        if (json.user && !json.user.googleConnected) setShow(true)
      })
      .catch(() => {})
  }, [])

  if (!show) return null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#D4A853] text-black">
        <Mail className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-amber-900">
          Connect your Google account
        </div>
        <div className="text-xs text-amber-800">
          Enable email scanning, calendar sync, and smart deadline detection.
        </div>
      </div>
      <button
        onClick={() => router.push('/me/settings')}
        className="rounded-xl bg-[#D4A853] px-4 py-2 text-sm font-semibold text-black hover:brightness-95"
      >
        Connect Google Account
      </button>
      <button
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, '1')
          setShow(false)
        }}
        aria-label="Dismiss"
        className="rounded-lg p-1.5 text-amber-700 hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
