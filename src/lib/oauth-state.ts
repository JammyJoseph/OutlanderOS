// The `state` parameter for Google sign-in flows: who started the flow, and for
// the shared accounts, which one they are connecting.
//
// Two holes this closes (2026-10-20):
//
//   * The shared-account flow put a bare label ("primary") in `state`, and the
//     callback had no auth check. Anyone holding a Google code for this app —
//     the client id is public in every consent URL — could call the callback
//     and replace the shared calendar account with their own.
//   * The per-user flow signed `{ userId }` with the session secret, which made
//     its state a valid session token: it travels through Google's redirect and
//     lands in browser history and the nginx access log.
//
// Now every state is signed, typed so it can never pass as a session, short-
// lived, and checked against the session of the browser finishing the flow.

import jwt from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/jwt-secret'

const TYP = 'oauth-state'

/** The shared Google accounts an admin can connect. The label is also a token-store key. */
export const SHARED_GOOGLE_ACCOUNTS = ['primary', 'billing'] as const
export type SharedGoogleAccount = (typeof SHARED_GOOGLE_ACCOUNTS)[number]

export function isSharedGoogleAccount(label: unknown): label is SharedGoogleAccount {
  return typeof label === 'string' && (SHARED_GOOGLE_ACCOUNTS as readonly string[]).includes(label)
}

export interface OAuthState {
  userId: string
  /** Set for the shared-account flow; absent when a person connects their own Google. */
  account?: SharedGoogleAccount
}

export function signOAuthState(state: OAuthState): string {
  return jwt.sign({ typ: TYP, ...state }, getJwtSecret(), { expiresIn: '30m' })
}

/** Null for anything that is not a live state this app issued. */
export function readOAuthState(raw: string | null | undefined): OAuthState | null {
  if (!raw) return null
  try {
    const claims = jwt.verify(raw, getJwtSecret()) as jwt.JwtPayload
    if (claims.typ !== TYP || typeof claims.userId !== 'string') return null
    if (claims.account !== undefined && !isSharedGoogleAccount(claims.account)) return null
    return { userId: claims.userId, account: claims.account }
  } catch {
    return null
  }
}
