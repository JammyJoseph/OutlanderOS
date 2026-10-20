// One password rule, used everywhere a password is set.
//
// There were three: eight characters to change your own, eight to reset, and
// six when an admin set one for somebody else — so the weakest path was the one
// that sets passwords for other people.
//
// The rule is length, because length is what makes a password hard to guess,
// plus a refusal of the handful of passwords every attacker tries first. No
// "must contain a symbol" requirements: they push people towards "Password1!"
// and do little else (NIST SP 800-63B says the same).

import crypto from 'crypto'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-rules'

export { MIN_PASSWORD_LENGTH }

const OBVIOUS = new Set([
  'password', 'password1', 'password123', 'qwertyuiop', '1234567890', '0123456789',
  'letmein123', 'welcome123', 'iloveyou12', 'outlander1', 'outlanderos', 'changeme12',
])

/** Null when the password is acceptable, otherwise a sentence to show the person. */
export function passwordProblem(password: unknown, context: { email?: string } = {}): string | null {
  if (typeof password !== 'string' || !password) return 'Enter a password.'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (password.length > 200) return 'That password is too long.'
  if (OBVIOUS.has(password.toLowerCase())) {
    return 'That password is one of the first ones people guess. Choose another.'
  }
  const local = context.email?.split('@')[0]?.toLowerCase()
  if (local && local.length >= 3 && password.toLowerCase().includes(local)) {
    return "Don't use your email address in your password."
  }
  return null
}

/**
 * Reset tokens are stored hashed. The raw token goes in the email and nowhere
 * else, so somebody who can read the database — a backup, a leaked dump — finds
 * nothing they can use to take over an account. Plain SHA-256 is right here:
 * the token is 256 random bits, so there is nothing for a slow hash to protect.
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}
