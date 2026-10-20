// The one place a session cookie becomes a person.
//
// Every route, page and guard in the app asks this function who is signed in.
// There used to be four separate answers — `getOptionalAuthUser`,
// `getCurrentUser`, `requireAdminPage` and an inline verify in the share page —
// and all four did the same thing: check the token's signature and believe
// whatever it said.
//
// That meant a session was only as current as the moment it was issued. Tested
// on production on 20 October 2026: a token for a user who had never existed,
// claiming ADMIN, was accepted by the admin user list. In practice that meant:
//
//   * deactivating someone did not stop them — their cookie kept working for
//     up to 30 days;
//   * demoting an admin did not stop them either, for the same 30 days;
//   * a password change left every other device signed in;
//   * a stolen cookie could not be revoked at all.
//
// Now the token only says WHICH user and WHICH session version. Everything else
// — name, email, role, whether they may sign in at all — is read from the
// database on every request. It is one primary-key lookup; for a team of seven
// that is nothing, and it means a change takes effect on the very next request.
//
// Tokens issued before this file existed carry no version. They are treated as
// version 0, which matches every account's starting value, so deploying this
// signs nobody out. The first password change or deactivation after it does.

import jwt from 'jsonwebtoken'
import prisma from '@/lib/prisma'
import { getJwtSecret } from '@/lib/jwt-secret'

export interface SessionUser {
  userId: string
  email: string
  role: string
  name: string
}

export const SESSION_TTL = '30d'

interface SessionClaims extends jwt.JwtPayload {
  /** 'session'. Other tokens signed with the same secret carry a different typ. */
  typ?: string
  userId?: string
  /** Session version the token was issued under. Absent on pre-2026-10 tokens. */
  sv?: number
  email?: string
}

/**
 * Is this a session token, rather than some other token signed with the same
 * secret? The Google OAuth state used to be `{ userId }` under this secret, so
 * it passed for a session — and it travels through Google's redirect into
 * browser history and the nginx log.
 *
 * Sessions now carry `typ: 'session'`. Ones issued before 2026-10-20 don't, but
 * every one of them carries an email, which no other token ever has. They all
 * expire by 2026-11-19; after that the legacy branch can go.
 */
function isSessionToken(claims: SessionClaims): boolean {
  if (claims.typ !== undefined) return claims.typ === 'session'
  return typeof claims.email === 'string'
}

/**
 * Issues a session token. Carries only the user id and session version — the
 * role and name ride along for the proxy's cosmetic redirects, but nothing
 * trusts them; resolveSession reads both from the database.
 */
export function signSession(user: {
  id: string
  email: string
  name: string
  role: string
  sessionVersion: number
}): string {
  return jwt.sign(
    {
      typ: 'session',
      userId: user.id,
      sv: user.sessionVersion,
      // Read by src/proxy.ts for redirects only. Never authoritative.
      email: user.email,
      name: user.name,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: SESSION_TTL }
  )
}

/**
 * Turns a raw cookie value into the signed-in person, or null.
 *
 * Null for: no token, a bad signature, an expired token, a user who no longer
 * exists, a deactivated user, and a token issued before their last session
 * reset. Callers never need to distinguish these — each one means "not signed
 * in", and telling an attacker which it was helps only the attacker.
 */
export async function resolveSession(token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null

  let claims: SessionClaims
  try {
    claims = jwt.verify(token, getJwtSecret()) as SessionClaims
  } catch {
    return null
  }
  if (!claims?.userId || !isSessionToken(claims)) return null

  const user = await prisma.user.findUnique({
    where: { id: String(claims.userId) },
    select: { id: true, email: true, name: true, role: true, isActive: true, sessionVersion: true },
  })
  if (!user || user.isActive === false) return null
  if ((claims.sv ?? 0) !== user.sessionVersion) return null

  return { userId: user.id, email: user.email, name: user.name, role: user.role }
}

/**
 * Ends every session this person has, everywhere. Returns the new version, so
 * the caller can re-issue a cookie for the device that asked for the change —
 * otherwise changing your own password would sign you out of the screen you
 * changed it on.
 */
export async function endAllSessions(userId: string): Promise<number> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  })
  return updated.sessionVersion
}
