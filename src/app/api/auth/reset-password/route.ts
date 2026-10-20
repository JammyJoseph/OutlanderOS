import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { endAllSessions } from '@/lib/session'
import { hashResetToken, passwordProblem } from '@/lib/password-policy'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limit = checkRateLimit(`reset-password:${ip}`, 10)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const { token, newPassword } = await request.json()

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Reset token required' }, { status: 400 })
  }
  // Stored hashed (see hashResetToken). The raw token only ever exists in the
  // email and in this request.
  const user = await prisma.user.findUnique({ where: { resetToken: hashResetToken(token) } })
  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired.' },
      { status: 400 }
    )
  }
  if (user.isActive === false) {
    return NextResponse.json(
      { error: 'This account has been switched off. Ask an admin to turn it back on.' },
      { status: 403 }
    )
  }

  const problem = passwordProblem(newPassword, { email: user.email })
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(newPassword, 10),
      resetToken: null,
      resetTokenExpiry: null,
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  })
  // A reset is how somebody recovers an account they may have lost control of,
  // so every existing session ends, including whoever else might be in it.
  await endAllSessions(user.id)

  return NextResponse.json({ message: 'Password updated. You can now sign in.' })
}
