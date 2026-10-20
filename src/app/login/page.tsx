'use client'

// Sign in, and "forgot password", as two separate forms on one page.
//
// They used to share a single <form>, so pressing Enter in the forgot-password
// box submitted the LOGIN form — with an empty password — and answered with a
// login error. Two forms, each with its own submit, means Enter does what the
// box you are typing in is for.
//
// The page never shows a reset link. A reset link is a credential, and it
// belongs in the inbox of the person it is for.

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthClose, AuthHeading, AuthShell } from '@/components/auth/AuthShell'
import { AuthAlert, AuthButton, AuthField, AuthLinkButton, AuthNotice } from '@/components/auth/AuthField'
import { useUser } from '@/components/user-context'

type View = 'signin' | 'forgot' | 'sent'

function SignIn() {
  const router = useRouter()
  const params = useSearchParams()
  const { refetch } = useUser()
  const justReset = params.get('reset') === '1'

  const [view, setView] = useState<View>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)

  // Move focus to the new heading whenever the view changes, so a screen reader
  // announces where you are instead of leaving focus on a button that vanished.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    heading.current?.focus()
  }, [view])

  const go = (next: View) => {
    setError('')
    setResent(false)
    setView(next)
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Try again.')
        setBusy(false)
        return
      }
      // The app-wide user was fetched while signed out; load it now so the next
      // page knows who you are without a reload.
      await refetch()
      const next = params.get('next')
      // Only ever a path on this site, never somewhere else.
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/hub?from=login'
      router.push(data.mustChangePassword ? '/me/change-password' : safeNext)
      router.refresh()
    } catch {
      setError("Can't reach OutlanderOS. Check your connection and try again.")
      setBusy(false)
    }
  }

  async function requestReset(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Something went wrong. Try again.')
      } else if (view === 'sent') {
        setResent(true)
      } else {
        setView('sent')
      }
    } catch {
      setError("Can't reach OutlanderOS. Check your connection and try again.")
    }
    setBusy(false)
  }

  if (view === 'sent') {
    return (
      <AuthShell right={<AuthClose onClick={() => go('signin')} label="Back to log in" />} footer={false}>
        <div className="flex flex-col items-center gap-7 pt-4 text-center">
          <span className="flex size-28 items-center justify-center rounded-full bg-accent text-brand">
            <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5.5" width="18" height="13" rx="2" />
              <path d="m3.5 7 8.5 6 8.5-6" />
            </svg>
          </span>
          <AuthHeading focusRef={heading} condensed>
            Check your email
          </AuthHeading>
          <AuthAlert>{error}</AuthAlert>
          <AuthNotice>
            If <strong className="font-semibold text-foreground">{email}</strong>{' '}
            has an account, we&rsquo;ve sent it a reset link. It expires in 60 minutes. Check your spam folder if it
            hasn&rsquo;t arrived in a couple of minutes.
          </AuthNotice>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {resent ? (
              'Sent again.'
            ) : (
              <>
                Didn&rsquo;t get it? <AuthLinkButton onClick={() => requestReset()}>Send again</AuthLinkButton>
              </>
            )}
          </p>
        </div>
      </AuthShell>
    )
  }

  if (view === 'forgot') {
    return (
      <AuthShell right={<AuthClose onClick={() => go('signin')} label="Back to log in" />} footer={false}>
        <button
          type="button"
          onClick={() => go('signin')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Back
        </button>
        <AuthHeading focusRef={heading} sub="Enter the email you log in with. We'll send a link that works for 60 minutes.">
          Reset your password
        </AuthHeading>
        <AuthAlert>{error}</AuthAlert>
        <form onSubmit={requestReset} className="grid gap-6" noValidate>
          <AuthField
            id="reset-email"
            label="Email address"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            placeholder="you@outlandermag.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <AuthButton busy={busy} busyLabel="Sending…">
            Send reset link
          </AuthButton>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered it? <AuthLinkButton onClick={() => go('signin')}>Log in</AuthLinkButton>
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthHeading
        focusRef={heading}
        sub={<>Log in with your Outlander email. Need an account? <span className="font-semibold text-foreground">Ask an admin.</span></>}
      >
        Welcome back
      </AuthHeading>
      {justReset && !error && <AuthNotice>Password changed. Log in with your new one.</AuthNotice>}
      <AuthAlert>{error}</AuthAlert>
      <form onSubmit={signIn} className="grid gap-6" noValidate>
        <AuthField
          id="email"
          label="Email address"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="email"
          placeholder="you@outlandermag.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          labelAside={<AuthLinkButton onClick={() => go('forgot')}>Forgot password?</AuthLinkButton>}
        />
        <label className="flex cursor-pointer items-center gap-3 text-[15px] text-ink-2">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-5 accent-foreground"
          />
          Keep me logged in for 30 days
        </label>
        <AuthButton busy={busy} busyLabel="Logging in…">
          Log in
        </AuthButton>
      </form>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <SignIn />
    </Suspense>
  )
}
