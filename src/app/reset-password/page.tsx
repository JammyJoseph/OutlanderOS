'use client'

// Choosing a new password from an emailed link.
//
// The old version told anyone without a link to "ask an admin to generate one".
// Self-service reset by email has worked since September, so the dead end now
// points back at the form that sends the link.

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthHeading, AuthShell } from '@/components/auth/AuthShell'
import { AuthAlert, AuthButton, AuthField, PasswordRules } from '@/components/auth/AuthField'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-rules'

const linkClass =
  'text-sm font-semibold text-foreground underline underline-offset-4 hover:text-hero-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

function ResetForm() {
  const token = useSearchParams().get('token')
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!token) {
    return (
      <>
        <AuthHeading sub="This page needs the link from your reset email, and the one you opened is incomplete.">
          That link doesn&rsquo;t work
        </AuthHeading>
        <Link href="/login" className={linkClass}>
          Request a new link
        </Link>
      </>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError("The two passwords don't match.")
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setExpired(/invalid or has expired/i.test(data.error ?? ''))
        setError(data.error || 'Something went wrong. Try again.')
        setBusy(false)
        return
      }
      router.push('/login?reset=1')
    } catch {
      setError("Can't reach Outlander OS. Check your connection and try again.")
      setBusy(false)
    }
  }

  return (
    <>
      <AuthHeading sub="This signs you out on every other device.">
        Choose a new password
      </AuthHeading>
      {error && (
        <AuthAlert>
          {error}
          {expired && (
            <>
              {' '}
              <Link href="/login" className="underline underline-offset-4">
                Request a new link
              </Link>
              .
            </>
          )}
        </AuthAlert>
      )}
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <AuthField
          id="new-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <AuthField
          id="confirm-password"
          label="Type it again"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <PasswordRules password={password} confirm={confirm} min={MIN_PASSWORD_LENGTH} />
        <AuthButton busy={busy} busyLabel="Saving…">
          Save password
        </AuthButton>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  )
}
