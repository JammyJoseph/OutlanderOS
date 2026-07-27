import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

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
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({ where: { resetToken: token } })
  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired.' },
      { status: 400 }
    )
  }
  if (user.isActive === false) {
    return NextResponse.json(
      { error: 'Account deactivated. Contact your administrator.' },
      { status: 403 }
    )
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(newPassword, 10),
      resetToken: null,
      resetTokenExpiry: null,
      mustChangePassword: false,
    },
  })

  return NextResponse.json({ message: 'Password updated. You can now sign in.' })
}
