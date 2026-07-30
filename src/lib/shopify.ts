// ═══════════════════════════════════════════════════════════════════════════
// Shopify Admin API client.
//
// Two things about Shopify's current auth make this less trivial than the other
// integrations in here:
//
//  1. There is no long-lived token any more. Custom apps authenticate with the
//     client credentials grant, and the token Shopify hands back expires after
//     24 hours. So the credentials in the environment are a client ID/secret,
//     not a token, and tokens are minted on demand and cached in memory.
//
//  2. Order history is capped at the last 60 days unless the app holds the
//     `read_all_orders` scope, which Shopify grants by manual review. We drop
//     once a year, so without that scope a sync legitimately returns nothing —
//     which must not look like a bug. `assertHistoryScope` makes it explicit.
//
// Reads only. Nothing here can write to the store.
// ═══════════════════════════════════════════════════════════════════════════

const TOKEN_URL = (shop: string) => `https://${shop}/admin/oauth/access_token`
const GRAPHQL_URL = (shop: string, version: string) =>
  `https://${shop}/admin/api/${version}/graphql.json`

export interface ShopifyConfig {
  shop: string
  clientId: string
  clientSecret: string
  apiVersion: string
}

export class ShopifyNotConfiguredError extends Error {
  constructor() {
    super(
      'Shopify is not configured. Set SHOPIFY_SHOP_DOMAIN, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.'
    )
    this.name = 'ShopifyNotConfiguredError'
  }
}

export class ShopifyError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown
  ) {
    super(message)
    this.name = 'ShopifyError'
  }
}

export function shopifyConfig(): ShopifyConfig | null {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN
  const clientId = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
  if (!shop || !clientId || !clientSecret) return null
  return {
    shop,
    clientId,
    clientSecret,
    // Shopify ships quarterly and drops versions after ~12 months. Pinned, not
    // "latest", so an upstream release can't change our results overnight.
    apiVersion: process.env.SHOPIFY_API_VERSION || '2026-07',
  }
}

export const isShopifyConfigured = () => shopifyConfig() != null

function requireConfig(): ShopifyConfig {
  const cfg = shopifyConfig()
  if (!cfg) throw new ShopifyNotConfiguredError()
  return cfg
}

// ── Token cache ─────────────────────────────────────────────────────────────
//
// Process-local. A pm2 restart just re-mints, which costs one request. Expiry
// is deliberately treated as 60s earlier than Shopify says, so a token can't
// go stale mid-request during a long bulk poll.
let cached: { token: string; scopes: string[]; expiresAt: number } | null = null
const SKEW_MS = 60_000

export async function getAccessToken(force = false): Promise<string> {
  const cfg = requireConfig()
  if (!force && cached && Date.now() < cached.expiresAt) return cached.token

  const res = await fetch(TOKEN_URL(cfg.shop), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  })

  const body = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok || !body.access_token) {
    // Shopify's failure modes here are specific and worth naming, because the
    // fix for each is completely different and the raw error is opaque.
    const code = String(body.error ?? res.status)
    if (code === 'app_not_installed') {
      throw new ShopifyError(
        'The app is registered but not installed on the store. Install it from Settings → Apps → Develop apps → Build apps in Dev Dashboard → Installs.'
      )
    }
    if (code === 'invalid_client') {
      throw new ShopifyError('Shopify rejected the client ID or secret.')
    }
    throw new ShopifyError(`Could not get a Shopify access token (${code}).`, body)
  }

  cached = {
    token: String(body.access_token),
    scopes: String(body.scope ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    expiresAt: Date.now() + Number(body.expires_in ?? 86_399) * 1000 - SKEW_MS,
  }
  return cached.token
}

export async function grantedScopes(): Promise<string[]> {
  await getAccessToken()
  return cached?.scopes ?? []
}

/**
 * Without `read_all_orders` Shopify silently returns only the last 60 days.
 * For an annual drop that's an empty dataset that looks exactly like a broken
 * sync, so callers check this and say so rather than reporting "0 orders".
 */
export async function hasFullHistoryAccess(): Promise<boolean> {
  return (await grantedScopes()).includes('read_all_orders')
}

// ── GraphQL ─────────────────────────────────────────────────────────────────

export async function shopifyGraphQL<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const cfg = requireConfig()

  const run = async (token: string) =>
    fetch(GRAPHQL_URL(cfg.shop, cfg.apiVersion), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    })

  let res = await run(await getAccessToken())
  // A 401 mid-flight means the cached token died earlier than advertised.
  // One forced re-mint, then give up — retrying a genuine auth failure forever
  // just turns a clear error into a hang.
  if (res.status === 401) res = await run(await getAccessToken(true))

  if (!res.ok) {
    throw new ShopifyError(`Shopify API returned ${res.status}`, await res.text().catch(() => ''))
  }

  const body = (await res.json()) as { data?: T; errors?: unknown[] }
  if (body.errors?.length) {
    throw new ShopifyError('Shopify GraphQL error', body.errors)
  }
  if (!body.data) throw new ShopifyError('Shopify returned no data')
  return body.data
}

export async function shopInfo(): Promise<{ name: string; currencyCode: string; myshopifyDomain: string }> {
  const d = await shopifyGraphQL<{
    shop: { name: string; currencyCode: string; myshopifyDomain: string }
  }>(`{ shop { name currencyCode myshopifyDomain } }`)
  return d.shop
}

// ── Bulk operations ─────────────────────────────────────────────────────────
//
// The right tool for "every order ever". A normal paginated query would need
// hundreds of round trips against a cost-based rate limit; a bulk operation
// runs server-side and hands back a JSONL file with no page ceiling.
//
// Shopify allows ONE bulk query per shop at a time, so a run that finds one
// already in flight cancels it rather than failing — otherwise a single
// abandoned job blocks syncing until it times out on Shopify's side.

const ORDERS_BULK_QUERY = `
{
  orders {
    edges {
      node {
        id
        name
        createdAt
        cancelledAt
        test
        displayFinancialStatus
        displayFulfillmentStatus
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        currentSubtotalPriceSet { shopMoney { amount } }
        currentTotalTaxSet { shopMoney { amount } }
        totalShippingPriceSet { shopMoney { amount } }
        currentTotalDiscountsSet { shopMoney { amount } }
        customer { id }
        shippingAddress { countryCodeV2 provinceCode city }
        lineItems {
          edges {
            node {
              id
              sku
              title
              variantTitle
              quantity
              originalUnitPriceSet { shopMoney { amount } }
              product { id }
              variant { id }
            }
          }
        }
      }
    }
  }
}`

interface BulkOperation {
  id: string
  status: string
  errorCode: string | null
  objectCount: string | null
  url: string | null
}

async function currentBulkOperation(): Promise<BulkOperation | null> {
  const d = await shopifyGraphQL<{ currentBulkOperation: BulkOperation | null }>(
    `{ currentBulkOperation(type: QUERY) { id status errorCode objectCount url } }`
  )
  return d.currentBulkOperation
}

async function cancelBulkOperation(id: string): Promise<void> {
  await shopifyGraphQL(
    `mutation ($id: ID!) { bulkOperationCancel(id: $id) { userErrors { message } } }`,
    { id }
  ).catch(() => undefined)
}

/**
 * Runs the orders bulk query and returns the JSONL download URL.
 * `onProgress` is called on each poll so a long backfill isn't a silent wait.
 */
export async function runOrdersBulkQuery(opts: {
  timeoutMs?: number
  pollMs?: number
  onProgress?: (status: string, objectCount: number) => void
} = {}): Promise<{ url: string | null; objectCount: number }> {
  const timeoutMs = opts.timeoutMs ?? 10 * 60_000
  const pollMs = opts.pollMs ?? 3_000

  const existing = await currentBulkOperation()
  if (existing && (existing.status === 'RUNNING' || existing.status === 'CREATED')) {
    await cancelBulkOperation(existing.id)
  }

  const started = await shopifyGraphQL<{
    bulkOperationRunQuery: { bulkOperation: BulkOperation | null; userErrors: { message: string }[] }
  }>(
    `mutation ($query: String!) {
       bulkOperationRunQuery(query: $query) {
         bulkOperation { id status errorCode objectCount url }
         userErrors { field message }
       }
     }`,
    { query: ORDERS_BULK_QUERY }
  )

  const errs = started.bulkOperationRunQuery.userErrors
  if (errs?.length) throw new ShopifyError(errs.map((e) => e.message).join('; '))

  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (Date.now() > deadline) {
      throw new ShopifyError(`Shopify bulk export did not finish within ${Math.round(timeoutMs / 60000)} minutes.`)
    }
    await new Promise((r) => setTimeout(r, pollMs))

    const op = await currentBulkOperation()
    if (!op) continue
    opts.onProgress?.(op.status, Number(op.objectCount ?? 0))

    if (op.status === 'COMPLETED') {
      // A completed export with no URL means zero matching objects — which for
      // us usually means the 60-day window, not an empty store.
      return { url: op.url, objectCount: Number(op.objectCount ?? 0) }
    }
    if (['FAILED', 'CANCELED', 'EXPIRED'].includes(op.status)) {
      throw new ShopifyError(`Shopify bulk export ${op.status.toLowerCase()}: ${op.errorCode ?? 'no reason given'}`)
    }
  }
}

/**
 * Streams a bulk JSONL result, yielding one parsed object per line.
 *
 * Bulk output is flat: child rows (line items) appear as their own lines with a
 * `__parentId`, NOT nested under the parent. Buffering the whole file to
 * reassemble it would defeat the point of streaming, so the caller stitches
 * children to parents as they arrive.
 */
export async function* streamJsonl(url: string): AsyncGenerator<Record<string, unknown>> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new ShopifyError(`Could not download bulk result (${res.status})`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line) yield JSON.parse(line)
    }
  }
  const last = buf.trim()
  if (last) yield JSON.parse(last)
}
