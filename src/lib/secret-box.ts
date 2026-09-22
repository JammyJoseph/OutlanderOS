// Authenticated encryption for secrets that have to live in the database.
//
// Written for the Xero refresh token, which is the worst thing in the codebase
// to lose: Xero rotates it on every single use, so the value in storage is
// valid exactly once. It previously sat in plaintext in `.tokens.json` beside
// three Google grants, written non-atomically, in the deploy directory.
//
// AES-256-GCM rather than CBC or a bare cipher: GCM authenticates as well as
// encrypts, so a tampered or truncated ciphertext fails loudly at `decrypt()`
// instead of yielding plausible garbage that gets sent to Xero as a bearer
// token.
//
// The key is derived from NEXTAUTH_SECRET with HKDF and a fixed info string.
// One fewer secret to provision, rotate and lose — and NEXTAUTH_SECRET already
// has to be present and secret for the app to run at all. The consequence is
// worth stating plainly: rotating NEXTAUTH_SECRET invalidates every stored
// secret, and the Xero connection has to be re-consented. That is a five-minute
// job for an admin and it is the correct failure — the alternative is a second
// secret nobody remembers exists until it is missing.
//
// Format is `v1.<iv-b64>.<tag-b64>.<ciphertext-b64>`. The version prefix is
// there so a future scheme can be introduced without guessing at the layout of
// what is already stored.

import crypto from 'crypto'

const VERSION = 'v1'
const ALGO = 'aes-256-gcm'
const IV_BYTES = 12 // 96 bits, the size GCM is specified for
const KEY_BYTES = 32

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecretBoxError'
  }
}

let cachedKey: Buffer | null = null

/**
 * Derives the encryption key. Cached per process — HKDF is cheap but this runs
 * on every token read, and a Xero sync reads it a lot.
 */
function key(): Buffer {
  if (cachedKey) return cachedKey
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new SecretBoxError(
      'NEXTAUTH_SECRET is missing or too short — cannot encrypt stored secrets.'
    )
  }
  // Salt is fixed and non-secret. HKDF's salt guards against related-key
  // attacks across contexts; the `info` string is what separates this use from
  // any future one, and a random salt would have to be stored anyway.
  const derived = crypto.hkdfSync(
    'sha256',
    Buffer.from(secret, 'utf8'),
    Buffer.from('outlanderos.secret-box.v1', 'utf8'),
    Buffer.from('oauth-token-at-rest', 'utf8'),
    KEY_BYTES
  )
  cachedKey = Buffer.from(derived)
  return cachedKey
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGO, key(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.')
}

/**
 * Throws rather than returning null on a bad ciphertext. A caller that treats
 * "could not decrypt" as "no token" would silently send an unauthenticated
 * request and report Xero as disconnected, hiding a real corruption.
 */
export function decrypt(payload: string): string {
  const parts = payload.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new SecretBoxError(`Unrecognised secret format (${parts[0] ?? 'empty'}).`)
  }
  const [, ivB64, tagB64, dataB64] = parts
  try {
    const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    // Deliberately not echoing the underlying error — it can contain fragments
    // of key material in some OpenSSL builds.
    throw new SecretBoxError(
      'Stored secret could not be decrypted. It was written with a different NEXTAUTH_SECRET, or it has been tampered with.'
    )
  }
}

/** For tests and diagnostics: is this string one of ours? */
export function looksEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION}.`) && value.split('.').length === 4
}
