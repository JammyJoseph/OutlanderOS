'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); setLoading(false); return }
      router.push('/me')
      router.refresh()
    } catch { setError('Connection error'); setLoading(false) }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      {/* Decorative gradient washes */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-[#ffd700]/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-[#c77dff]/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-[#4d9fff]/10 blur-3xl" />

      <div className="relative w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400 mb-2">Outlander Magazine</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Outlander<span className="text-[#ffd700]">OS</span></h1>
          <p className="text-sm text-gray-500 mt-2">Sign in to your workspace</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-2xl border border-[#2a2a2a] bg-[#141414]/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-md space-y-4">
          {error && <div className="text-sm text-[#ff6b6b] bg-[#ff6b6b]/10 border border-[#ff6b6b]/20 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-white text-sm placeholder:text-[#666666] focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:border-transparent transition-all"
              placeholder="you@outlandermag.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ffd700] focus:border-transparent transition-all" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#ffd700] text-black font-semibold text-sm hover:brightness-110 disabled:opacity-50 transition-all duration-200">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="mt-6 text-center text-[11px] text-gray-400">Internal operating system · Outlander Magazine</p>
      </div>
    </div>
  )
}
