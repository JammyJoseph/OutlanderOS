import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from "@/lib/jwt-secret"
import { authCookieOptions } from '@/lib/auth-cookie'


export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  // Normalised the same way every other lookup does it. Addresses are stored
  // lowercase, so "Silver@..." — which is what a phone's keyboard offers by
  // default — missed the row entirely and came back as "Invalid credentials",
  // indistinguishable from a wrong password. A pasted address with a trailing
  // space did the same.
  const user = await prisma.user.findUnique({
    where: { email: String(email).trim().toLowerCase() },
  })
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Deactivated staff keep their data but can't log in.
  if (user.isActive === false) {
    return NextResponse.json(
      { error: 'Account deactivated. Contact your administrator.' },
      { status: 403 }
    )
  }

  // Record the sign-in time for the admin staff list.
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, name: user.name },
    getJwtSecret(),
    { expiresIn: '30d' }
  )

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    mustChangePassword: user.mustChangePassword === true,
  })
  response.cookies.set('auth_token', token, authCookieOptions())

  // New accounts log in with a temporary password. Drop a lightweight flag the
  // proxy uses to lock them onto the change-password screen until it's cleared.
  // Readable by the proxy, so not httpOnly — it carries no secret.
  if (user.mustChangePassword === true) {
    response.cookies.set('must_change_pw', '1', {
      ...authCookieOptions(),
      httpOnly: false,
    })
  } else {
    response.cookies.set('must_change_pw', '', {
      ...authCookieOptions(0),
      httpOnly: false,
    })
  }
  return response
}
