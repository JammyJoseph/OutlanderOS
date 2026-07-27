import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { getOptionalAuthUser, isAdminInDb } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const TOKEN_TTL_MS = 60 * 60 * 1000

const GENERIC_MESSAGE =
  'If an account exists with that email, a reset link has been generated. Contact your admin for the link.'

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

  const link = `/reset-password?token=${token}`
  console.log(`[forgot-password] reset link for ${user.email}: ${link}`)

  return NextResponse.json({
    message: GENERIC_MESSAGE,
    ...(callerIsAdmin ? { link } : {}),
  })
}
