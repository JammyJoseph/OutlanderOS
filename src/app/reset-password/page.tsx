'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#161922] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9C7C2E] focus:border-transparent transition-all'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not reset password')
        setLoading(false)
        return
      }
      router.push('/login?reset=1')
    } catch {
      setError('Connection error')
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-[#2a2a2a] bg-[#0e1018]/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-md">
        <p className="text-sm text-gray-300">
          This page needs a reset link. Ask an admin to generate one for you.
        </p>
        <a href="/login" className="mt-4 block text-sm text-[#C9A44A] hover:underline">
          Back to sign in
        </a>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#2a2a2a] bg-[#0e1018]/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-md space-y-4"
    >
      {error && (
        <div className="text-sm text-[#ff6b6b] bg-[#ff6b6b]/10 border border-[#ff6b6b]/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">New password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-[#111111] text-white dark:bg-white dark:text-black font-semibold text-sm hover:brightness-110 disabled:opacity-50 transition-all duration-200"
      >
        {loading ? 'Saving...' : 'Set new password'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#05060a]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,#10131f_0%,#05060a_55%,#020308_100%)]"
      />
      <div className="relative w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400 mb-2">
            Outlander Magazine
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/OutlanderOS_Logo_Dark.svg"
            alt="OutlanderOS"
            className="mx-auto h-8 w-auto"
          />
          <p className="text-sm text-gray-400 mt-2">Choose a new password</p>
        </div>
        <Suspense
          fallback={
            <div className="rounded-2xl border border-[#2a2a2a] bg-[#0e1018]/80 p-6 text-sm text-gray-400">
              Loading...
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
