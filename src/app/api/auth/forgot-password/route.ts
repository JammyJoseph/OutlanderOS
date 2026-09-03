import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { getOptionalAuthUser, isAdminInDb } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { sendPasswordReset } from '@/lib/auth-email'

const TOKEN_TTL_MS = 60 * 60 * 1000

// Same answer whether or not the address exists. Anything more specific turns
// this endpoint into a way to test which addresses have accounts.
const GENERIC_MESSAGE =
  'If an account exists with that email, we have sent a reset link. Check your inbox, and your spam folder.'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limit = checkRateLimit(`forgot-password:${ip}`, 5)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const { email } = await request.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  // The reset link is only ever returned to an admin who is already signed in.
  // Handing it to an anonymous caller would make every account, including other
  // admins', takeable by anyone who knows the address.
  const caller = await getOptionalAuthUser(request)
  const callerIsAdmin = caller ? await isAdminInDb(caller) : false

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  })

  if (!user || user.isActive === false) {
    return NextResponse.json({ message: GENERIC_MESSAGE })
  }

  const token = crypto.randomBytes(32).toString('hex')
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: new Date(Date.now() + TOKEN_TTL_MS) },
  })

  // Absolute, because it goes in an email. NEXTAUTH_URL is the staff host —
  // the public contributor hostname deliberately doesn't serve /reset-password.
  const proto = request.headers.get('x-forwarded-proto') ?? 'http'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const base = process.env.NEXTAUTH_URL || `${proto}://${host}`
  const path = `/reset-password?token=${token}`
  const link = `${base}${path}`

  // The whole point of this route, and for months the one thing it didn't do.
  // It was written when the app had no mailer at all, so it logged the link and
  // relied on an admin reading it out of pm2 — which meant a locked-out person
  // with no admin to hand simply stayed locked out.
  const delivery = await sendPasswordReset({
    to: user.email,
    name: user.name,
    link,
    expiresInMinutes: Math.round(TOKEN_TTL_MS / 60000),
  })

  // Never log the token itself. It is a live credential until it's used, and a
  // pm2 log is readable by anyone with server access — see docs/ROADMAP.md 6.5.
  if (delivery.sent) {
    console.log(`[forgot-password] reset email sent to ${user.email}`)
  } else {
    console.error(`[forgot-password] reset email FAILED for ${user.email}: ${delivery.error}`)
  }

  return NextResponse.json({
    message: GENERIC_MESSAGE,
    // An admin still gets the link back, which is the fallback when mail is
    // down — and now also gets told whether the email actually left.
    ...(callerIsAdmin ? { link, emailSent: delivery.sent, emailError: delivery.error } : {}),
  })
}
