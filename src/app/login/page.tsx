'use client'

// Sign in, and "forgot password", as two separate forms on one page.
//
// They used to share a single <form>, so pressing Enter in the forgot-password
// box submitted the LOGIN form — with an empty password — and answered with a
// login error. Two forms, each with its own submit, means Enter does what the
// box you are typing in is for.
//
// The page never shows a reset link. The old one could display a live link on
// screen for an admin; a reset link is a credential, and it belongs in the
// inbox of the person it is for.

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthHeading, AuthShell } from '@/components/auth/AuthShell'
import {
  AuthAlert,
  AuthButton,
  AuthField,
  AuthLinkButton,
  AuthNotice,
} from '@/components/auth/AuthField'

type View = 'signin' | 'forgot' | 'sent'

function SignIn() {
  const router = useRouter()
  const params = useSearchParams()
  const justReset = params.get('reset') === '1'

  const [view, setView] = useState<View>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
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
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Try again.')
        setBusy(false)
        return
      }
      const next = params.get('next')
      // Only ever a path on this site, never somewhere else.
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/me'
      router.push(data.mustChangePassword ? '/me/change-password' : safeNext)
      router.refresh()
    } catch {
      setError("Can't reach Outlander OS. Check your connection and try again.")
      setBusy(false)
    }
  }

  async function requestReset(e: React.FormEvent) {
    e.preventDefault()
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
      } else {
        setView('sent')
      }
    } catch {
      setError("Can't reach Outlander OS. Check your connection and try again.")
    }
    setBusy(false)
  }

  if (view === 'sent') {
    return (
      <>
        <AuthHeading focusRef={heading} sub={<>If <strong className="text-foreground">{email}</strong> has an account, a reset link is on its way. It works for one hour.</>}>
          Check your email
        </AuthHeading>
        <p className="mb-8 text-sm text-muted-foreground">
          Nothing after a few minutes? Look in your spam folder, then try again.
        </p>
        <AuthLinkButton onClick={() => go('signin')}>Back to sign in</AuthLinkButton>
      </>
    )
  }

  if (view === 'forgot') {
    return (
      <>
        <AuthHeading focusRef={heading} sub="We'll email you a link to choose a new one.">
          Reset your password
        </AuthHeading>
        <AuthAlert>{error}</AuthAlert>
        <form onSubmit={requestReset} className="grid gap-5" noValidate>
          <AuthField
            id="reset-email"
            label="Email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <AuthButton busy={busy} busyLabel="Sending…">
            Send reset link
          </AuthButton>
        </form>
        <div className="mt-6">
          <AuthLinkButton onClick={() => go('signin')}>Back to sign in</AuthLinkButton>
        </div>
      </>
    )
  }

  return (
    <>
      <AuthHeading focusRef={heading} sub="Use your Outlander email address.">
        Sign in
      </AuthHeading>
      {justReset && !error && <AuthNotice>Password changed. Sign in with your new one.</AuthNotice>}
      <AuthAlert>{error}</AuthAlert>
      <form onSubmit={signIn} className="grid gap-5" noValidate>
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="email"
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
        />
        <AuthButton busy={busy} busyLabel="Signing in…">
          Sign in
        </AuthButton>
      </form>
      {/* After the button, not in the password label row: there it sat between
          the two fields in tab order, so Tab from Email landed on this link. */}
      <div className="mt-6">
        <AuthLinkButton onClick={() => go('forgot')}>Forgot your password?</AuthLinkButton>
      </div>
      <p className="mt-10 text-sm text-muted-foreground">
        New here, or locked out? An admin can set you up or reset your access.
      </p>
    </>
  )
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <SignIn />
      </Suspense>
    </AuthShell>
  )
}
