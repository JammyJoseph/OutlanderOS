import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from "@/lib/jwt-secret"


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
    const payload = jwt.verify(token, getJwtSecret()) as CurrentUser
    if (!payload?.userId) return null
    return payload
  } catch {
    return null
  }
}
