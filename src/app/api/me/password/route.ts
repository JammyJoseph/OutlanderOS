import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'

export async function PUT(request: NextRequest) {
  const me = getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await request.json()
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 })
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: me.userId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })

  const hash = await bcrypt.hash(newPassword, 10)
  // Clearing the temp password also lifts the first-login lock. We report back
  // whether this was the user's onboarding change so the client can route them
  // through the one-time welcome screen.
  const wasOnboarding = user.mustChangePassword === true
  await prisma.user.update({
    where: { id: me.userId },
    data: { password: hash, mustChangePassword: false },
  })

  const response = NextResponse.json({ ok: true, onboarding: wasOnboarding })
  // Release the proxy lock so the user can navigate freely again.
  response.cookies.set('must_change_pw', '', { maxAge: 0, path: '/' })
  return response
}
