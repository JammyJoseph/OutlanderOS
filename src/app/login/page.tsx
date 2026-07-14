'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

// Deterministic pseudo-random so the star field is identical on server and
// client (no hydration mismatch) but still looks scattered.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Star {
  top: number
  left: number
  size: number
  delay: number
  duration: number
  opacity: number
}

function useStars(count: number): Star[] {
  return useMemo(() => {
    const rand = mulberry32(20260630)
    return Array.from({ length: count }, () => ({
      top: rand() * 100,
      left: rand() * 100,
      size: rand() * 1.6 + 0.6,
      delay: rand() * 6,
      duration: rand() * 3 + 2.5,
      opacity: rand() * 0.5 + 0.3,
    }))
  }, [count])
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const stars = useStars(90)

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
      router.push(data.mustChangePassword ? '/me/change-password' : '/me')
      router.refresh()
    } catch { setError('Connection error'); setLoading(false) }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#05060a]">
      {/* ── Ambient night sky ─────────────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Deep gradient backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,#10131f_0%,#05060a_55%,#020308_100%)]" />

        {/* Star field */}
        {stars.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white login-twinkle"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.opacity,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}

        {/* Moon — glowing orb, top-right, gently drifting */}
        <div className="absolute right-[8%] top-[12%] login-moon-float">
          <div
            className="relative h-[200px] w-[200px] rounded-full"
            style={{
              background:
                'radial-gradient(circle at 35% 30%, #ffffff 0%, #e8edf7 35%, #b9c4dc 70%, #8a98bd 100%)',
              boxShadow:
                '0 0 60px 18px rgba(190,205,255,0.35), 0 0 140px 50px rgba(120,150,255,0.18), inset -18px -14px 40px rgba(60,72,110,0.55)',
            }}
          >
            {/* Soft craters */}
            <span className="absolute left-[28%] top-[30%] h-5 w-5 rounded-full bg-[#9aa6c4]/40" />
            <span className="absolute left-[58%] top-[55%] h-7 w-7 rounded-full bg-[#9aa6c4]/30" />
            <span className="absolute left-[44%] top-[68%] h-3.5 w-3.5 rounded-full bg-[#9aa6c4]/35" />

            {/* Flagpole + waving Outlander flag, planted on the moon */}
            <div className="absolute left-1/2 top-[-58px] -translate-x-1/2">
              <div className="relative h-[64px] w-[2px] bg-gradient-to-b from-[#f2f4fa] to-[#aab2c8]">
                <span className="absolute left-1/2 top-[-3px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#9C7C2E] shadow-[0_0_6px_#9C7C2E]" />
                <div className="absolute left-[2px] top-0 origin-left login-flag-wave">
                  <div className="flex h-[26px] w-[38px] items-center justify-center rounded-r-[3px] bg-gradient-to-r from-[#9C7C2E] to-[#C9A44A] shadow-md">
                    <span className="font-extrabold text-[15px] leading-none text-black">O</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle colour washes for depth */}
        <div className="absolute -bottom-40 -left-40 h-[480px] w-[480px] rounded-full bg-[#2F4B8F]/8 blur-3xl" />
        <div className="absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full bg-[#6B4E8E]/8 blur-3xl" />
      </div>

      {/* ── Login card ─────────────────────────────────────────────────── */}
      <div className="relative w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400 mb-2">Outlander Magazine</p>
          {/* Always the white-fill cut: this page sits on the space backdrop in
              both themes, so it can't follow the dark: variant. */}
          <h1>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/OutlanderOS_Logo_Dark.svg"
              alt="OutlanderOS"
              className="mx-auto h-8 w-auto"
            />
          </h1>
          <p className="text-sm text-gray-400 mt-2">Sign in to your workspace</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-2xl border border-[#2a2a2a] bg-[#0e1018]/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-md space-y-4">
          {error && <div className="text-sm text-[#ff6b6b] bg-[#ff6b6b]/10 border border-[#ff6b6b]/20 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#161922] text-white text-sm placeholder:text-[#666666] focus:outline-none focus:ring-2 focus:ring-[#9C7C2E] focus:border-transparent transition-all"
              placeholder="you@outlandermag.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-[#2a2a2a] bg-[#161922] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9C7C2E] focus:border-transparent transition-all" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#111111] text-white dark:bg-white dark:text-black font-semibold text-sm hover:brightness-110 disabled:opacity-50 transition-all duration-200">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="mt-6 text-center text-[11px] text-gray-500">Internal operating system · Outlander Magazine</p>
      </div>

      <style>{`
        @keyframes loginTwinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50%      { opacity: 1;    transform: scale(1.1); }
        }
        .login-twinkle { animation-name: loginTwinkle; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }

        @keyframes loginMoonFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        .login-moon-float { animation: loginMoonFloat 5s ease-in-out infinite; }

        @keyframes loginFlagWave {
          0%, 100% { transform: rotate(-2deg) skewX(0deg) scaleY(1); }
          35%      { transform: rotate(1.5deg) skewX(-5deg) scaleY(0.97); }
          65%      { transform: rotate(-1deg) skewX(4deg) scaleY(1.02); }
        }
        .login-flag-wave { animation: loginFlagWave 3.2s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .login-twinkle, .login-moon-float, .login-flag-wave { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
