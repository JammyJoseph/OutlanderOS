// ═══════════════════════════════════════════════════════════════════════════
// Shopify order CSV import.
//
// The way round the 60-day wall. Without `read_all_orders` the Admin API cannot
// see older orders at all — `ordersCount` returns 0, not a real total — but the
// store owner can still export the full history from Orders → Export in the
// admin, because that is a merchant feature and answers to no access scope.
//
// So: CSV for the backfill, API for everything ongoing. That split works
// permanently, not just as a stopgap, because an annual drop's sales all land
// well inside 60 days of the drop — the API only ever struggles with history.
//
// Two things about Shopify's export shape drive this parser:
//
//   • One row per LINE ITEM, not per order.
//   • Order-level columns are populated only on the FIRST row of each order;
//     subsequent rows repeat the order Name with everything else blank.
//
// Parsing row-by-row without accounting for that would produce one order per
// line item, each with a £0 total.
// ═══════════════════════════════════════════════════════════════════════════

export interface ParsedOrder {
  id: string
  name: string
  orderedAt: Date
  currency: string
  totalPrice: number
  subtotalPrice: number
  totalShipping: number
  totalTax: number
  totalDiscounts: number
  financialStatus: string | null
  fulfillmentStatus: string | null
  cancelledAt: Date | null
  isTest: boolean
  shipCountryCode: string | null
  shipProvinceCode: string | null
  shipCity: string | null
  customerId: string | null
  lines: {
    id: string
    sku: string | null
    title: string
    variantTitle: string | null
    quantity: number
    price: number
  }[]
}

export interface ParseResult {
  orders: ParsedOrder[]
  rows: number
  skipped: number
  problems: string[]
}

// ── CSV reader ──────────────────────────────────────────────────────────────
// Hand-rolled rather than a dependency: Shopify's export is RFC-4180 with
// quoted fields, embedded commas and doubled quotes, and product titles
// routinely contain all three.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  // Strip a UTF-8 BOM — Excel adds one and it corrupts the first header name,
  // which silently breaks the "Name" column lookup.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < src.length; i++) {
    const c = src[i]

    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += c
      }
      continue
    }

    if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      // Swallow the \n of a \r\n pair.
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
    } else {
      field += c
    }
  }

  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)
  return rows
}

// ── Country handling ────────────────────────────────────────────────────────
// Shopify exports the country as a display name ("United Kingdom"), while the
// API gives ISO-2. Territory grouping keys off ISO-2, so names must be mapped
// or every CSV order lands in "Unknown".
const COUNTRY_TO_ISO: Record<string, string> = {
  'united kingdom': 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
  'united states': 'US', 'united states of america': 'US', usa: 'US',
  canada: 'CA', ireland: 'IE', france: 'FR', germany: 'DE', italy: 'IT', spain: 'ES',
  netherlands: 'NL', belgium: 'BE', portugal: 'PT', sweden: 'SE', denmark: 'DK',
  norway: 'NO', finland: 'FI', poland: 'PL', austria: 'AT', switzerland: 'CH',
  greece: 'GR', czechia: 'CZ', 'czech republic': 'CZ', hungary: 'HU', romania: 'RO',
  japan: 'JP', 'south korea': 'KR', 'korea, republic of': 'KR', china: 'CN',
  'hong kong': 'HK', 'hong kong sar': 'HK', taiwan: 'TW', singapore: 'SG',
  malaysia: 'MY', thailand: 'TH', vietnam: 'VN', philippines: 'PH', indonesia: 'ID',
  india: 'IN', australia: 'AU', 'new zealand': 'NZ',
  'united arab emirates': 'AE', 'saudi arabia': 'SA', qatar: 'QA', kuwait: 'KW',
  israel: 'IL', turkey: 'TR', 'türkiye': 'TR',
  brazil: 'BR', argentina: 'AR', chile: 'CL', colombia: 'CO', mexico: 'MX', peru: 'PE',
  'south africa': 'ZA',
}

export function toIsoCountry(raw: string | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  // Already a code.
  if (v.length === 2) return v.toUpperCase()
  return COUNTRY_TO_ISO[v.toLowerCase()] ?? null
}

const num = (v: string | undefined): number => {
  if (!v) return 0
  // Strip currency symbols and thousands separators; exports vary by locale.
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

const date = (v: string | undefined): Date | null => {
  if (!v?.trim()) return null
  const d = new Date(v.trim())
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Parses a Shopify orders CSV export into orders with their line items.
 *
 * Orders are keyed by the `Name` column ("#1001"). The synthetic id is prefixed
 * `csv:` so an imported row can never collide with a Shopify GID, and so a
 * later API sync of the same order creates a second row rather than silently
 * merging two records whose fields came from different places.
 */
export function parseShopifyOrdersCsv(text: string): ParseResult {
  const rows = parseCsv(text)
  const problems: string[] = []
  if (rows.length < 2) {
    return { orders: [], rows: 0, skipped: 0, problems: ['The file has no data rows.'] }
  }

  const header = rows[0].map((h) => h.trim())
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase())

  const cName = idx('Name')
  const cLineQty = idx('Lineitem quantity')
  if (cName < 0 || cLineQty < 0) {
    return {
      orders: [],
      rows: rows.length - 1,
      skipped: rows.length - 1,
      problems: [
        'This does not look like a Shopify orders export — no "Name" or "Lineitem quantity" column. Export from Orders → Export in the Shopify admin, not from Analytics.',
      ],
    }
  }

  const col = {
    createdAt: idx('Created at'),
    currency: idx('Currency'),
    total: idx('Total'),
    subtotal: idx('Subtotal'),
    shipping: idx('Shipping'),
    taxes: idx('Taxes'),
    discount: idx('Discount Amount'),
    financial: idx('Financial Status'),
    fulfillment: idx('Fulfillment Status'),
    cancelled: idx('Cancelled at'),
    country: idx('Shipping Country'),
    province: idx('Shipping Province'),
    city: idx('Shipping City'),
    lineQty: cLineQty,
    lineName: idx('Lineitem name'),
    linePrice: idx('Lineitem price'),
    lineSku: idx('Lineitem sku'),
  }

  const byName = new Map<string, ParsedOrder>()
  let skipped = 0
  let unmappedCountries = 0

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const get = (i: number) => (i >= 0 ? row[i] : undefined)
    const name = (get(cName) ?? '').trim()
    if (!name) {
      skipped++
      continue
    }

    let order = byName.get(name)
    if (!order) {
      const created = date(get(col.createdAt))
      if (!created) {
        // Without a date the order can't be placed on any timeline, and every
        // figure here is time-based. Skip loudly rather than default to now().
        skipped++
        continue
      }
      const rawCountry = get(col.country)
      const iso = toIsoCountry(rawCountry)
      if (rawCountry?.trim() && !iso) unmappedCountries++

      order = {
        id: `csv:${name}`,
        name,
        orderedAt: created,
        currency: (get(col.currency) ?? 'GBP').trim() || 'GBP',
        totalPrice: num(get(col.total)),
        subtotalPrice: num(get(col.subtotal)),
        totalShipping: num(get(col.shipping)),
        totalTax: num(get(col.taxes)),
        totalDiscounts: num(get(col.discount)),
        financialStatus: (get(col.financial) ?? '').trim() || null,
        fulfillmentStatus: (get(col.fulfillment) ?? '').trim() || null,
        cancelledAt: date(get(col.cancelled)),
        isTest: false,
        shipCountryCode: iso,
        shipProvinceCode: (get(col.province) ?? '').trim().toUpperCase() || null,
        shipCity: (get(col.city) ?? '').trim() || null,
        customerId: null,
        lines: [],
      }
      byName.set(name, order)
    }

    const qty = Number(get(col.lineQty) ?? 0)
    if (!Number.isFinite(qty) || qty <= 0) continue

    order.lines.push({
      id: `csv:${name}:${order.lines.length}`,
      sku: (get(col.lineSku) ?? '').trim() || null,
      title: (get(col.lineName) ?? '').trim() || 'Untitled item',
      variantTitle: null,
      quantity: qty,
      price: num(get(col.linePrice)),
    })
  }

  if (unmappedCountries > 0) {
    problems.push(
      `${unmappedCountries} order(s) had a shipping country this importer doesn't recognise; they'll group under "Unknown" territory.`
    )
  }
  if (skipped > 0) {
    problems.push(`${skipped} row(s) skipped — no order name or no valid date.`)
  }

  return { orders: [...byName.values()], rows: rows.length - 1, skipped, problems }
}
