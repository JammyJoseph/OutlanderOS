import { withErrorHandling } from "@/lib/api-error"
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { logger } from '@/lib/logger'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'outlander-os-secret'

async function POST__inner(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    logger.warn('auth', 'Failed login attempt — unknown email', { email })
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    logger.warn('auth', 'Failed login attempt — bad password', { email })
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  logger.info('auth', 'Successful login', { email })

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  )

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return response
}

export const POST = withErrorHandling(POST__inner as any)
