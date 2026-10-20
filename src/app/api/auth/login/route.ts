import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { authCookieOptions } from '@/lib/auth-cookie'
import { signSession } from '@/lib/session'

// Sign-in.
//
// Two independent brakes on password guessing, because either one alone can be
// got round:
//
//   * per address — 5 attempts a minute from one IP, applied in src/proxy.ts
//     before this handler runs (not here as well, or every attempt would count
//     twice against the same key). The IP comes from the header nginx sets, not
//     the one the client writes; before 2026-10-20 a different X-Forwarded-For
//     on every request bypassed it entirely.
//   * per account — 8 wrong passwords lock that account for 15 minutes, no
//     matter how many addresses the guesses come from. This is the one that
//     stops a distributed attack on a single person.
//
// A lockout does not reveal whether the account exists: an unknown address gets
// the same "too many attempts" answer once it has been tried as often.

const MAX_FAILURES = 8
const LOCK_MS = 15 * 60 * 1000
const GENERIC_FAILURE = 'That email and password do not match.'

// A real bcrypt hash of a random string, compared against when the email is
// unknown. Without it, an unknown address answers in ~1ms and a known one in
// ~60ms, which tells anybody with a stopwatch which addresses have accounts.
// Generated at startup rather than pasted in, because a malformed literal makes
// bcrypt return instantly and silently removes the protection.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10)

// Unknown addresses have no row to count failures on, so they are counted here.
// In memory is fine: it only exists to make an unknown address behave the same
// as a known one, and losing it on restart costs nothing.
const unknownFailures = new Map<string, { count: number; until: number }>()

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')
  if (!email || !password) {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  const lockedFor = (until: number) =>
    NextResponse.json(
      { error: 'Too many wrong passwords for this account. Try again in 15 minutes, or reset your password.' },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((until - Date.now()) / 1000))) } }
    )

  // ── Unknown address: spend the same time, count the same way ─────────────
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH)
    const entry = unknownFailures.get(email)
    if (entry && entry.until > Date.now()) return lockedFor(entry.until)
    const count = (entry && entry.until <= Date.now() ? 0 : entry?.count ?? 0) + 1
    unknownFailures.set(email, {
      count,
      until: count >= MAX_FAILURES ? Date.now() + LOCK_MS : 0,
    })
    if (unknownFailures.size > 5000) unknownFailures.clear()
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 })
  }

  // ── Known account ────────────────────────────────────────────────────────
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    // Still compare, so a locked account takes as long as an unlocked one.
    await bcrypt.compare(password, DUMMY_HASH)
    return lockedFor(user.lockedUntil.getTime())
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    const failures = user.failedLoginCount + 1
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failures >= MAX_FAILURES ? 0 : failures,
        lockedUntil: failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null,
      },
    })
    if (failures >= MAX_FAILURES) {
      console.warn(`[login] ${user.email} locked for 15 minutes after ${MAX_FAILURES} wrong passwords`)
      return lockedFor(Date.now() + LOCK_MS)
    }
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 })
  }

  // Checked after the password, so it is only ever told to the real owner.
  if (user.isActive === false) {
    return NextResponse.json(
      { error: 'This account has been switched off. Ask an admin to turn it back on.' },
      { status: 403 }
    )
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  })

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    mustChangePassword: user.mustChangePassword === true,
  })
  response.cookies.set('auth_token', signSession(user), authCookieOptions())

  // New accounts, and anyone given a password by an admin, must choose their
  // own before doing anything else. The proxy reads this flag to hold them on
  // the change-password screen. Not httpOnly — it carries no secret.
  response.cookies.set('must_change_pw', user.mustChangePassword ? '1' : '', {
    ...authCookieOptions(user.mustChangePassword ? undefined : 0),
    httpOnly: false,
  })
  return response
}
