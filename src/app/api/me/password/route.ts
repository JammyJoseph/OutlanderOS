import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/current-user'
import { authCookieOptions } from '@/lib/auth-cookie'
import { endAllSessions, signSession } from '@/lib/session'
import { passwordProblem } from '@/lib/password-policy'

export async function PUT(request: NextRequest) {
  const me = await getCurrentUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await request.json()
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: me.userId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const problem = passwordProblem(newPassword, { email: user.email })
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

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

  // A new password signs out every other device — the usual reason to change
  // one is suspecting somebody else has it. This device gets a fresh cookie
  // under the new session version, so it stays signed in.
  const sessionVersion = await endAllSessions(me.userId)

  const response = NextResponse.json({ ok: true, onboarding: wasOnboarding })
  response.cookies.set(
    'auth_token',
    signSession({ ...user, sessionVersion }),
    authCookieOptions()
  )
  // Release the proxy lock so the user can navigate freely again.
  // Attributes must match the cookie set at login or the browser may not clear it.
  response.cookies.set('must_change_pw', '', {
    ...authCookieOptions(0),
    httpOnly: false,
  })
  return response
}
