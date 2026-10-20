// Simple in-memory rate limiter keyed by client IP.
// Scoped per running server instance — adequate for a small internal team
// portal, not a substitute for a distributed limiter at scale.

interface Bucket {
  count: number
  resetAt: number
}

const WINDOW_MS = 60_000
const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  retryAfter: number
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs = WINDOW_MS
): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count += 1
  return { ok: true, retryAfter: 0 }
}

// The client's address, as nginx saw it.
//
// X-Real-IP first, because nginx SETS it from $remote_addr, overwriting anything
// the client sent. The old code read the first entry of X-Forwarded-For — which
// is the one the client writes, since nginx only appends. Verified on production
// 2026-10-20: a different X-Forwarded-For on each request walked straight past
// the login limit, eight attempts in a row, none refused.
//
// The fallback is the LAST X-Forwarded-For entry, the one nginx appended. The
// app port is also bound to localhost and firewalled, so nothing reaches it
// without passing through nginx first.
export function getClientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")
  if (real) return real.trim()
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1]
  }
  return "local"
}

// Expensive AI/Claude-backed endpoints get a tighter budget.
const AI_PATHS = new Set([
  "/api/think-tank/ingest",
  "/api/think-tank/reports/generate",
])

// Picks the request-per-minute budget for a given API path.
function limitForPath(pathname: string): { scope: string; limit: number } {
  if (pathname === "/api/auth/login") return { scope: "login", limit: 5 }
  if (AI_PATHS.has(pathname)) {
    return { scope: "ai", limit: 10 }
  }
  return { scope: "std", limit: 100 }
}

let lastSweep = Date.now()
function maybeSweep(now: number): void {
  if (now - lastSweep < WINDOW_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key)
  }
}

// Returns a 429 Response if the request exceeds its tier's budget, else null.
export function rateLimitResponse(
  request: Request,
  pathname: string
): Response | null {
  maybeSweep(Date.now())
  const { scope, limit } = limitForPath(pathname)
  const ip = getClientIp(request)
  const result = checkRateLimit(`${scope}:${ip}`, limit)
  if (result.ok) return null
  return Response.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfter || 60) },
    }
  )
}
