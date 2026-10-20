'use client'

import { useState } from 'react'
import { AuthHeading } from '@/components/auth/AuthShell'
import { AuthAlert, AuthButton, AuthField, PasswordRules } from '@/components/auth/AuthField'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-rules'

export default function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError("The two new passwords don't match.")
      return
    }
    if (password === current) {
      setError('Choose a password different from the one you have now.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Couldn't change your password. Try again.")
        setBusy(false)
        return
      }
      // A hard navigation, not router.push: the response has just cleared the
      // must_change_pw cookie, and a soft navigation can race the proxy and
      // bounce straight back here. A full load sends the updated cookies.
      window.location.assign(data.onboarding ? '/welcome' : '/me?password=changed')
    } catch {
      setError("Can't reach OutlanderOS. Check your connection and try again.")
      setBusy(false)
    }
  }

  return (
    <>
      <AuthHeading
        sub={
          forced
            ? 'You signed in with a temporary password. Choose your own to carry on. Nobody else will know it.'
            : 'This signs you out on every other device.'
        }
      >
        {forced ? 'Choose your password' : 'Change your password'}
      </AuthHeading>
      <AuthAlert>{error}</AuthAlert>
      <form onSubmit={submit} className="grid gap-6" noValidate>
        <AuthField
          id="current-password"
          label={forced ? 'Temporary password' : 'Current password'}
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
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
          {forced ? 'Save and continue' : 'Change password'}
        </AuthButton>
      </form>
    </>
  )
}
