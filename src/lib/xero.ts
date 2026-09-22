// The Xero client. One of them.
//
// This replaces three overlapping implementations that were all live at once:
// `xero-client.ts` (xero-node SDK, hardcoded localhost redirect), `xero-api.ts`
// (raw fetch, its own refresh), and `xero-finance.ts` (raw fetch, its own
// refresh again). Each had a different idea of where tokens lived and when to
// refresh them, and between them they produced a connection that has been dead
// in production since July.
//
// Four things are fixed here by construction rather than by care:
//
//  1. **The redirect URI is derived from NEXTAUTH_URL.** It was the string
//     'http://localhost:3000/api/xero/callback', so the consent flow could not
//     complete from production at all. Reconnecting was impossible, which is
//     why an expired token stayed expired for two months.
//  2. **Expiry is a DateTime.** The old store wrote `expires_at` in
//     milliseconds and the refresh check compared it against seconds, so the
//     proactive refresh never fired once. A token could only die.
//  3. **Tokens live in Postgres, encrypted, written in a transaction.** Xero
//     rotates the refresh token on every use; a half-written file is a
//     permanently severed connection.
//  4. **Refresh is serialised.** Two concurrent syncs both refreshing the same
//     grant means one of them persists a refresh token Xero has already
//     invalidated. In-process mutex plus a conditional update.
//
// Everything degrades to XeroDisconnectedError, which callers are expected to
// turn into "reconnect Xero" rather than a 500.

import prisma from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/secret-box'

const API_BASE = 'https://api.xero.com/api.xro/2.0'
const IDENTITY_BASE = 'https://identity.xero.com/connect/token'
const CONNECTIONS_URL = 'https://api.xero.com/connections'
const CONNECTION_ID = 'singleton'

/** Refresh this far before real expiry, so a long request can't straddle it. */
const REFRESH_SKEW_MS = 120_000

// Read-only today. Write scopes (accounting.transactions) arrive with the
// write-back phase; asking for them now would mean re-consenting then anyway,
// and a token that can only read is a smaller thing to lose.
export const XERO_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.settings.read',
  'accounting.contacts.read',
  'accounting.transactions.read',
  'accounting.reports.read',
].join(' ')

/**
 * Which of Xero's two authentication shapes this install uses.
 *
 * `XERO_CONNECTION_MODE=custom` selects a Custom Connection. It is explicit
 * rather than sniffed, because the two flows fail in opposite directions and a
 * wrong guess is confusing: a Custom Connection asked to run consent sends an
 * admin to a Xero screen that cannot complete, and a Web app asked for
 * client_credentials is simply refused.
 *
 * Custom Connections are the better fit for this system and the mode this
 * install is expected to run in. They are bound to one organisation when the
 * app is created, mint a 30-minute token from the client id and secret, and
 * have no refresh token — so the single most fragile thing in the old
 * integration, a rotating refresh token that dies if one write is lost, simply
 * does not exist.
 */
export function xeroMode(): 'CUSTOM' | 'AUTH_CODE' {
  return (process.env.XERO_CONNECTION_MODE ?? '').trim().toUpperCase() === 'CUSTOM'
    ? 'CUSTOM'
    : 'AUTH_CODE'
}

export class XeroDisconnectedError extends Error {
  /** True when a human must re-run consent; false when it may fix itself. */
  readonly needsReconsent: boolean
  constructor(message: string, needsReconsent = true) {
    super(message)
    this.name = 'XeroDisconnectedError'
    this.needsReconsent = needsReconsent
  }
}

export class XeroRateLimitError extends Error {
  readonly retryAfterSeconds: number
  constructor(retryAfterSeconds: number) {
    super(`Xero rate limit hit; retry in ${retryAfterSeconds}s`)
    this.name = 'XeroRateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

// ── OAuth ──────────────────────────────────────────────────────────────────

function clientCredentials(): { id: string; secret: string } {
  const id = process.env.XERO_CLIENT_ID
  const secret = process.env.XERO_CLIENT_SECRET
  if (!id || !secret) {
    throw new XeroDisconnectedError('XERO_CLIENT_ID / XERO_CLIENT_SECRET are not set.')
  }
  return { id, secret }
}

/**
 * The callback URL, derived rather than hardcoded.
 *
 * Must match a redirect URI registered on the Xero app exactly, including the
 * scheme and any trailing path. Local development and production therefore both
 * need registering — Xero allows several.
 */
export function xeroRedirectUri(): string {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/+$/, '')
  return `${base}/api/xero/callback`
}

export function xeroConsentUrl(state: string): string {
  const { id } = clientCredentials()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: id,
    redirect_uri: xeroRedirectUri(),
    scope: XERO_SCOPES,
    state,
  })
  return `https://login.xero.com/identity/connect/authorize?${params}`
}

function basicAuthHeader(): string {
  const { id, secret } = clientCredentials()
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64')
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope?: string
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(IDENTITY_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(),
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    // invalid_grant is terminal: the refresh token is spent or revoked and no
    // amount of retrying will help. Anything else may be transient.
    const terminal = res.status === 400 || /invalid_grant/i.test(text)
    throw new XeroDisconnectedError(
      `Xero rejected the token request (${res.status}). ${text.slice(0, 200)}`,
      terminal
    )
  }
  return (await res.json()) as TokenResponse
}

async function listTenants(accessToken: string) {
  const res = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new XeroDisconnectedError(`Could not list Xero organisations (${res.status}).`, false)
  }
  return (await res.json()) as Array<{ tenantId: string; tenantName: string }>
}

/**
 * Completes the consent flow and stores the connection. Called once, by an
 * admin, from the callback route.
 */
export async function completeXeroConnect(
  code: string,
  by: { userId?: string; name?: string }
): Promise<{ tenantName: string }> {
  const token = await postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: xeroRedirectUri(),
    })
  )

  const tenants = await listTenants(token.access_token)
  if (!tenants.length) {
    throw new XeroDisconnectedError('Consent succeeded but no Xero organisation was granted.')
  }
  const tenant = tenants[0]

  const row = {
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    accessTokenEnc: encrypt(token.access_token),
    refreshTokenEnc: encrypt(token.refresh_token),
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    scopes: token.scope ?? XERO_SCOPES,
    lastError: null,
    lastRefreshAt: new Date(),
  }

  await prisma.xeroConnection.upsert({
    where: { id: CONNECTION_ID },
    create: {
      id: CONNECTION_ID,
      ...row,
      connectedByUserId: by.userId ?? null,
      connectedByName: by.name ?? null,
    },
    update: {
      ...row,
      connectedAt: new Date(),
      connectedByUserId: by.userId ?? null,
      connectedByName: by.name ?? null,
      refreshCount: 0,
    },
  })

  return { tenantName: tenant.tenantName }
}

export async function disconnectXero(): Promise<void> {
  await prisma.xeroConnection.deleteMany({ where: { id: CONNECTION_ID } })
}

// ── The live connection ────────────────────────────────────────────────────

export interface XeroContext {
  accessToken: string
  tenantId: string
  tenantName: string
}

// Serialises refreshes within this process. Two concurrent callers finding an
// expired token would otherwise both refresh; the second would present a
// refresh token Xero invalidated a moment earlier, and the connection dies.
// Single pm2 fork process, so this is sufficient today — the conditional update
// below is what would carry it across instances.
let refreshInFlight: Promise<XeroContext> | null = null

async function loadConnection() {
  const conn = await prisma.xeroConnection.findUnique({ where: { id: CONNECTION_ID } })
  if (!conn) {
    throw new XeroDisconnectedError('Xero is not connected. An admin can connect it in Settings.')
  }
  if (conn.lastError) {
    throw new XeroDisconnectedError(
      `Xero needs reconnecting. Last error: ${conn.lastError}`,
      true
    )
  }
  return conn
}

async function doRefresh(): Promise<XeroContext> {
  const conn = await loadConnection()
  // A row with no refresh token is a Custom Connection that reached the wrong
  // branch — it has nothing to refresh and never will. Say so rather than
  // failing on a null further down, because the fix is a config change
  // (XERO_CONNECTION_MODE) and not a reconnection.
  if (!conn.refreshTokenEnc) {
    throw new XeroDisconnectedError(
      conn.mode === 'CUSTOM'
        ? 'This is a Custom Connection but XERO_CONNECTION_MODE is not set to "custom", so the refresh flow ran instead of minting a token.'
        : 'The stored Xero connection has no refresh token. Reconnect Xero.',
      true
    )
  }

  let token: TokenResponse
  try {
    token = await postToken(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: decrypt(conn.refreshTokenEnc),
      })
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const terminal = err instanceof XeroDisconnectedError ? err.needsReconsent : false
    if (terminal) {
      // Record it so every later call fails fast with a useful message rather
      // than hammering an endpoint that has already said no.
      await prisma.xeroConnection
        .update({ where: { id: CONNECTION_ID }, data: { lastError: message.slice(0, 480) } })
        .catch(() => {})
    }
    throw err
  }

  // Conditional on the stored token still being the one we refreshed from, so a
  // concurrent writer cannot be clobbered.
  const updated = await prisma.xeroConnection.updateMany({
    where: { id: CONNECTION_ID, refreshTokenEnc: conn.refreshTokenEnc },
    data: {
      accessTokenEnc: encrypt(token.access_token),
      refreshTokenEnc: encrypt(token.refresh_token),
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      scopes: token.scope ?? conn.scopes,
      lastRefreshAt: new Date(),
      refreshCount: { increment: 1 },
      lastError: null,
    },
  })

  if (updated.count !== 1) {
    // Somebody else refreshed between our read and our write. Their token is
    // the live one; ours is already spent. Re-read rather than overwrite.
    const fresh = await loadConnection()
    return {
      accessToken: decrypt(fresh.accessTokenEnc),
      tenantId: fresh.tenantId,
      tenantName: fresh.tenantName,
    }
  }

  return {
    accessToken: token.access_token,
    tenantId: conn.tenantId,
    tenantName: conn.tenantName,
  }
}

/**
 * Mints and caches a Custom Connection token.
 *
 * The token lasts 30 minutes and costs one call to replace, so it is cached in
 * XeroConnection purely to avoid re-minting on every request — losing the cache
 * is a non-event, unlike the AUTH_CODE path where losing the stored token ends
 * the connection permanently.
 *
 * The tenant is discovered once from /connections and kept. A Custom Connection
 * is bound to exactly one organisation, so it cannot drift.
 */
async function getCustomConnectionContext(): Promise<XeroContext> {
  const conn = await prisma.xeroConnection.findUnique({ where: { id: CONNECTION_ID } })
  if (conn && conn.mode === 'CUSTOM' && conn.expiresAt.getTime() - REFRESH_SKEW_MS > Date.now()) {
    return {
      accessToken: decrypt(conn.accessTokenEnc),
      tenantId: conn.tenantId,
      tenantName: conn.tenantName,
    }
  }

  const token = await postToken(new URLSearchParams({ grant_type: 'client_credentials' }))
  const tenants = await listTenants(token.access_token)
  if (!tenants.length) {
    // The credentials authenticate but reach no organisation. This is the
    // state a Custom Connection sits in after it is created and before an
    // organisation is authorised against it in Xero's developer portal — the
    // step that is easy to miss because the app looks finished without it.
    throw new XeroDisconnectedError(
      'The Xero Custom Connection authenticates but is not connected to an organisation. ' +
        'In the Xero developer portal, open the app and authorise it against the Outlander organisation.',
      true
    )
  }
  const tenant = tenants[0]

  const row = {
    mode: 'CUSTOM',
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    accessTokenEnc: encrypt(token.access_token),
    refreshTokenEnc: null,
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    scopes: token.scope ?? null,
    lastError: null,
    lastRefreshAt: new Date(),
  }
  await prisma.xeroConnection.upsert({
    where: { id: CONNECTION_ID },
    create: { id: CONNECTION_ID, ...row },
    update: { ...row, refreshCount: { increment: 1 } },
  })

  return {
    accessToken: token.access_token,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
  }
}

export async function getXeroContext(): Promise<XeroContext> {
  if (xeroMode() === 'CUSTOM') return getCustomConnectionContext()

  const conn = await loadConnection()
  if (conn.expiresAt.getTime() - REFRESH_SKEW_MS > Date.now()) {
    return {
      accessToken: decrypt(conn.accessTokenEnc),
      tenantId: conn.tenantId,
      tenantName: conn.tenantName,
    }
  }
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

// ── Requests ───────────────────────────────────────────────────────────────

interface GetOptions {
  /** Xero's incremental cursor. Returns only records changed since this time. */
  modifiedSince?: Date | null
  /** 1-based. Xero pages most collections at 100. */
  page?: number
  retries?: number
}

/**
 * A GET against the accounting API.
 *
 * Retries on 429 and 5xx with the Retry-After Xero supplies. Xero's limits are
 * 60 calls/minute and 5,000/day per org, and it answers 429 with the exact
 * number of seconds to wait — obeying it is both faster and politer than a
 * fixed backoff.
 */
export async function xeroGet<T = Record<string, unknown>>(
  endpoint: string,
  opts: GetOptions = {}
): Promise<T> {
  const retries = opts.retries ?? 3
  let attempt = 0

  for (;;) {
    const ctx = await getXeroContext()
    const url = new URL(`${API_BASE}${endpoint}`)
    if (opts.page) url.searchParams.set('page', String(opts.page))

    const headers: Record<string, string> = {
      Authorization: `Bearer ${ctx.accessToken}`,
      'Xero-Tenant-Id': ctx.tenantId,
      Accept: 'application/json',
    }
    if (opts.modifiedSince) {
      // Xero wants this without the timezone suffix.
      headers['If-Modified-Since'] = opts.modifiedSince.toISOString().replace(/\.\d+Z$/, '')
    }

    const res = await fetch(url, { headers })

    if (res.status === 429) {
      const wait = Number(res.headers.get('Retry-After') ?? '60') || 60
      if (attempt++ >= retries) throw new XeroRateLimitError(wait)
      await new Promise((r) => setTimeout(r, Math.min(wait, 60) * 1000))
      continue
    }
    if (res.status === 401) {
      // The access token was rejected despite not being expired by our clock.
      // One forced refresh, then give up — looping here is how you burn a
      // rate limit against a grant that has been revoked.
      if (attempt++ >= 1) {
        throw new XeroDisconnectedError('Xero rejected the access token.', true)
      }
      await prisma.xeroConnection
        .updateMany({ where: { id: CONNECTION_ID }, data: { expiresAt: new Date(0) } })
        .catch(() => {})
      continue
    }
    if (res.status >= 500) {
      if (attempt++ >= retries) {
        throw new XeroDisconnectedError(`Xero is unavailable (${res.status}).`, false)
      }
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      continue
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Xero ${res.status} on ${endpoint}: ${text.slice(0, 300)}`)
    }

    // 304 from If-Modified-Since: nothing changed. Xero sends an empty body.
    if (res.status === 304) return {} as T
    return (await res.json()) as T
  }
}

/** Connection state for the UI. Never throws. */
export async function getXeroStatus(): Promise<{
  connected: boolean
  organisation?: string
  error?: string
  needsReconsent?: boolean
  connectedAt?: string
  expiresAt?: string
}> {
  try {
    const conn = await prisma.xeroConnection.findUnique({ where: { id: CONNECTION_ID } })

    // A Custom Connection needs no stored row to work — the credentials alone
    // mint a token. So "no row" is not "not connected" here; ask Xero.
    if (!conn && xeroMode() === 'CUSTOM') {
      const ctx = await getXeroContext()
      return { connected: true, organisation: ctx.tenantName }
    }
    if (!conn) return { connected: false, error: 'Xero is not connected.', needsReconsent: true }
    if (conn.lastError) {
      return {
        connected: false,
        organisation: conn.tenantName,
        error: conn.lastError,
        needsReconsent: true,
      }
    }
    // Prove the token actually works rather than trusting the clock.
    const ctx = await getXeroContext()
    return {
      connected: true,
      organisation: ctx.tenantName,
      connectedAt: conn.connectedAt.toISOString(),
      expiresAt: conn.expiresAt.toISOString(),
    }
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
      needsReconsent: err instanceof XeroDisconnectedError ? err.needsReconsent : false,
    }
  }
}

// ── Money ──────────────────────────────────────────────────────────────────

/**
 * Xero decimal → integer pence.
 *
 * `Math.round` rather than truncation because 12.34 arrives from JSON as
 * 12.339999999999999 often enough to matter, and truncating it gives £12.33.
 * That is the exact class of penny error the mirror exists to avoid.
 */
export function toPence(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function fromPence(pence: number): number {
  return pence / 100
}

/**
 * Xero dates arrive either ISO ("2026-09-18T00:00:00") or as the .NET epoch
 * form ("/Date(1758153600000+0000)/"), depending on the endpoint. Both appear
 * in real responses from the same org.
 *
 * The zoneless ISO form is forced to UTC, and that is not a detail. Xero's
 * invoice and due dates are calendar dates with no time in them, but
 * `new Date("2026-09-18T00:00:00")` is specified to parse as LOCAL time — so
 * on a London server in summer it becomes 17 September 23:00Z. Stored that way,
 * an invoice due on the 18th reads as the 17th, every aging bucket is a day
 * early, and a month-boundary invoice lands in the wrong month's P&L. The unit
 * test for this caught it before it shipped; without the `Z` the whole mirror
 * is quietly a day out for half the year and correct for the other half, which
 * is the worst possible version of the bug.
 */
export function xeroDate(value: unknown): Date | null {
  if (!value) return null
  const s = String(value).trim()
  if (!s) return null

  const dotNet = s.match(/\/Date\((-?\d+)/)
  if (dotNet) {
    const d = new Date(Number(dotNet[1]))
    return Number.isNaN(d.getTime()) ? null : d
  }

  // No trailing Z and no ±hh:mm offset means Xero has given us a wall-clock
  // date with no zone. Treat it as UTC rather than as the server's timezone.
  const zoneless = !/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)
  const d = new Date(zoneless ? `${s.includes('T') ? s : `${s}T00:00:00`}Z` : s)
  return Number.isNaN(d.getTime()) ? null : d
}
