import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'outlander-os-secret'

export type CurrentUser = {
  userId: string
  email: string
  role: string
  name: string
}

export function getCurrentUser(request: NextRequest): CurrentUser | null {
  const token = request.cookies.get('auth_token')?.value
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET) as CurrentUser
    if (!payload?.userId) return null
    return payload
  } catch {
    return null
  }
}
