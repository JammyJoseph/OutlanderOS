import { NextRequest } from 'next/server'
import { resolveSession, type SessionUser } from '@/lib/session'

export type CurrentUser = SessionUser

// The signed-in person for this request, checked against the database.
// Was synchronous and signature-only; see src/lib/session.ts for what that let
// through. Callers now await it.
export async function getCurrentUser(request: NextRequest): Promise<CurrentUser | null> {
  return resolveSession(request.cookies.get('auth_token')?.value)
}
