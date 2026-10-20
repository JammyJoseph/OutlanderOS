'use client'

// Choosing a new password from an emailed link. Ends on the navy "Password
// updated" screen, which is also where the old sessions are said to be gone.

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AuthClose, AuthHeading, AuthShell } from '@/components/auth/AuthShell'
import { AuthAlert, AuthButton, AuthField, PasswordRules } from '@/components/auth/AuthField'
import { SuccessScreen, pill } from '@/components/os'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-rules'

const linkClass =
  'text-sm font-semibold text-foreground underline decoration-[1.5px] underline-offset-4 hover:text-brand ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

function ResetForm() {
  const token = useSearchParams().get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const doneHeading = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (done) doneHeading.current?.querySelector<HTMLElement>('h1')?.focus()
  }, [done])

  if (done) {
    return (
      <div ref={doneHeading}>
        <SuccessScreen
          title="Password updated"
          actions={
            <Link href="/login" className={pill('primary')}>
              Log in
            </Link>
          }
        >
          You can log in with your new password now. Any other sessions have been signed out.
        </SuccessScreen>
      </div>
    )
  }

  if (!token) {
    return (
      <AuthShell right={<AuthClose href="/login" label="Back to log in" />} footer={false}>
        <AuthHeading sub="This page needs the link from your reset email, and the one you opened is incomplete.">
          That link doesn&rsquo;t work
        </AuthHeading>
        <p className="text-center">
          <Link href="/login" className={linkClass}>
            Request a new link
          </Link>
        </p>
      </AuthShell>
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
      setDone(true)
    } catch {
      setError("Can't reach OutlanderOS. Check your connection and try again.")
      setBusy(false)
    }
  }

  return (
    <AuthShell right={<AuthClose href="/login" label="Back to log in" />} footer={false}>
      <AuthHeading sub="You'll use it every time you log in. Saving it signs you out on every other device.">
        Create a new password
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
      <form onSubmit={submit} className="grid gap-6" noValidate>
        <div className="grid gap-3">
          <AuthField
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordRules password={password} confirm={confirm} min={MIN_PASSWORD_LENGTH} />
        </div>
        <AuthField
          id="confirm-password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <AuthButton busy={busy} busyLabel="Saving…">
          Save password
        </AuthButton>
      </form>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  )
}
