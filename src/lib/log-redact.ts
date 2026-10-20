// Keeps credentials out of the server logs.
//
// Found 2026-10-20: when a Google call failed, `console.error('…', err)` printed
// the whole client error — and a Google client error carries the request it
// made, so the log held the refresh token, the client id and, on API calls,
// the `Authorization: Bearer` access token. pm2 keeps those logs on disk.
//
// Rather than trusting 115 call sites to log `err.message`, every console
// method on the server passes through here once (installed from
// instrumentation.ts):
//
//   * an HTTP-client error (anything carrying `config` / `response` /
//     `request`, the shape gaxios and axios errors share) is reduced to its
//     name, message, status and the server's own error text;
//   * everything else is printed as before, then scrubbed of anything shaped
//     like a token.

import { inspect } from 'node:util'

const PATTERNS: [RegExp, string][] = [
  // key = value / key: value / 'key' => 'value' for the OAuth secrets.
  [/((?:refresh|access|id)_token|client_secret|"code"|'code'|code_verifier)(["']?\s*(?:=>|[:=])\s*["']?)([A-Za-z0-9._\-/+]{8,})/gi, '$1$2[redacted]'],
  [/(Bearer\s+)[A-Za-z0-9._\-/+=]{8,}/g, '$1[redacted]'],
  [/\bya29\.[A-Za-z0-9._\-]+/g, '[redacted]'], // Google access token
  [/\b1\/\/0[A-Za-z0-9._\-]{20,}/g, '[redacted]'], // Google refresh token
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[redacted-jwt]'],
  [/(auth_token=)[^;\s'"]+/g, '$1[redacted]'],
]

export function redact(text: string): string {
  let out = text
  for (const [re, sub] of PATTERNS) out = out.replace(re, sub)
  return out
}

interface HttpishError {
  name?: string
  message?: string
  code?: string | number
  status?: number
  config?: unknown
  request?: unknown
  response?: { status?: number; data?: unknown }
}

function isHttpError(e: unknown): e is HttpishError {
  return !!e && typeof e === 'object' && ('config' in e || 'response' in e || 'request' in e)
}

function summarise(e: HttpishError): string {
  const status = e.response?.status ?? e.status ?? e.code
  const data = e.response?.data as { error?: unknown; error_description?: unknown } | undefined
  const detail = [data?.error, data?.error_description].filter((x) => typeof x === 'string').join(': ')
  return redact(`${e.name ?? 'Error'}: ${e.message ?? ''}${status ? ` (status ${status})` : ''}${detail ? ` — ${detail}` : ''}`)
}

function clean(arg: unknown): unknown {
  if (typeof arg === 'string') return redact(arg)
  if (isHttpError(arg)) return summarise(arg)
  if (arg instanceof Error) {
    const cause = (arg as Error & { cause?: unknown }).cause
    const base = redact(arg.stack ?? `${arg.name}: ${arg.message}`)
    return cause && isHttpError(cause) ? `${base}\n  caused by ${summarise(cause)}` : base
  }
  if (arg && typeof arg === 'object') return redact(inspect(arg, { depth: 4, breakLength: 120 }))
  return arg
}

let installed = false

export function installLogRedaction() {
  if (installed) return
  installed = true
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => original(...args.map(clean))
  }
}
