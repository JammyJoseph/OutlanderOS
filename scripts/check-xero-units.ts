// Unit checks for the Xero money, date and crypto helpers.
//
// Run:  npm run check:xero
//       (worth running under TZ=Europe/London and TZ=America/New_York — the
//        date bug below only appears in a timezone ahead of UTC)
//
// There is no test runner in this repo, so this is a plain script that exits
// non-zero on failure. Small enough to drop into CI later without rewriting.
//
// It exists because these three helpers are where a silent wrong answer is
// most expensive, and one of them was already wrong when written. `xeroDate`
// parsed Xero's zoneless "2026-09-18T00:00:00" as LOCAL time, so on a London
// server in BST every invoice and due date landed a day early — aging buckets
// off by one, month-boundary invoices in the wrong month's P&L, and all of it
// silently correct again in winter, which is the hardest version to notice.
// The "zoneless ISO is UTC" case below is that bug.
//
// The money cases make the argument for integer pence in one place: the float
// sum of 0.1 + 0.2 + 0.3 is not 0.6, and a reconciliation built on that
// produces penny variances against Xero that nobody can trace to a cause.

// Self-contained: secret-box refuses a key under 16 characters, and this
// script should run without anyone having to think about environment.
process.env.NEXTAUTH_SECRET ||= 'check-xero-units-local-only-not-a-real-secret'

import { encrypt, decrypt, looksEncrypted, SecretBoxError } from '@/lib/secret-box'
import { toPence, fromPence, xeroDate, xeroRedirectUri } from '@/lib/xero'

let failures = 0
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(46)} got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`)
}

console.log('=== secret-box ===')
const token = 'refresh-' + 'x'.repeat(200)
const sealed = encrypt(token)
check('round-trips a refresh-token-sized string', decrypt(sealed), token)
check('ciphertext is not the plaintext', sealed.includes(token), false)
check('looksEncrypted', looksEncrypted(sealed), true)
check('two encryptions of the same input differ (random IV)', encrypt(token) === encrypt(token), false)

// Tamper with the ciphertext body; GCM must reject it rather than return junk.
const parts = sealed.split('.')
const body = Buffer.from(parts[3], 'base64'); body[0] ^= 0xff
let rejected = false
try { decrypt([parts[0], parts[1], parts[2], body.toString('base64')].join('.')) }
catch (e) { rejected = e instanceof SecretBoxError }
check('rejects a tampered ciphertext', rejected, true)

console.log('\n=== money ===')
check('12.34 -> pence', toPence(12.34), 1234)
check('0.1 + 0.2 float artefact -> pence', toPence(0.1 + 0.2), 30)
check('string "1234.56" -> pence', toPence('1234.56'), 123456)
check('negative (credit note)', toPence(-99.99), -9999)
check('null -> 0', toPence(null), 0)
check('garbage -> 0', toPence('n/a'), 0)
check('round-trip 634868.95', fromPence(toPence(634868.95)), 634868.95)
// The exact case that motivated integer pence: summing in float drifts.
const floatSum = [0.1, 0.2, 0.3].reduce((a, b) => a + b, 0)
const penceSum = fromPence([0.1, 0.2, 0.3].reduce((a, b) => a + toPence(b), 0))
check('float sum of 0.1+0.2+0.3 is wrong', floatSum === 0.6, false)
check('pence sum of 0.1+0.2+0.3 is exact', penceSum, 0.6)

console.log('\n=== dates ===')
check('zoneless ISO is UTC, not local', xeroDate('2026-09-18T00:00:00')?.toISOString().slice(0, 10), '2026-09-18')
check('bare date is UTC midnight', xeroDate('2026-09-18')?.toISOString(), '2026-09-18T00:00:00.000Z')
check('explicit Z is respected', xeroDate('2026-09-18T09:30:00Z')?.toISOString(), '2026-09-18T09:30:00.000Z')
check('explicit offset is respected', xeroDate('2026-09-18T09:30:00+01:00')?.toISOString(), '2026-09-18T08:30:00.000Z')
check('empty string', xeroDate('   '), null)
check('.NET epoch form', xeroDate('/Date(1758153600000+0000)/')?.toISOString().slice(0, 10), '2025-09-18')
check('null', xeroDate(null), null)
check('garbage', xeroDate('not a date'), null)

console.log('\n=== redirect uri (the bug that killed the connection) ===')
process.env.NEXTAUTH_URL = 'https://os.outlanderdirectory.com'
check('derives from NEXTAUTH_URL', xeroRedirectUri(), 'https://os.outlanderdirectory.com/api/xero/callback')
process.env.NEXTAUTH_URL = 'https://os.outlanderdirectory.com/'
check('tolerates a trailing slash', xeroRedirectUri(), 'https://os.outlanderdirectory.com/api/xero/callback')

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall passed')
process.exit(failures ? 1 : 0)
