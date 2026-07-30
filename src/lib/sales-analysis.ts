// ═══════════════════════════════════════════════════════════════════════════
// Sales analysis — Shopify orders read as rollout inputs.
//
// Shopify Analytics already answers "how much did we sell". The question it
// can't answer, and the only reason this file exists, is "what should the next
// rollout's numbers be". Every function here maps order data onto a specific
// input in the distribution plan:
//
//   basketProfile  → the average basket the fulfilment economics assume
//   coverMix       → RolloutCover.sharePct
//   territoryDemand→ RolloutTerritory.b2cUnits
//   coastSplit     → RolloutPlan.eastCoastShare
//
// Cancelled and test orders are excluded everywhere. They are still stored, so
// a sync doesn't lose rows, but no figure should ever include them.
// ═══════════════════════════════════════════════════════════════════════════

export interface OrderRow {
  id: string
  name: string
  orderedAt: Date | string
  currency: string
  totalPrice: number
  totalShipping: number
  cancelledAt: Date | string | null
  isTest: boolean
  shipCountryCode: string | null
  shipProvinceCode: string | null
  customerId: string | null
  lineItems: LineRow[]
}

export interface LineRow {
  id: string
  sku: string | null
  title: string
  variantTitle: string | null
  quantity: number
  price: number
}

export const isSellable = (o: OrderRow) => !o.cancelledAt && !o.isTest

export const sellable = (orders: OrderRow[]) => orders.filter(isSellable)

const unitsIn = (o: OrderRow) => o.lineItems.reduce((s, l) => s + l.quantity, 0)

const asDate = (v: Date | string) => (typeof v === 'string' ? new Date(v) : v)

// ── Basket profile ──────────────────────────────────────────────────────────
//
// The single most valuable number here. The rollout's fulfilment economics
// price three scenarios — one copy per order, a basket of two, the Full Set —
// and currently just assume which one happens. This measures it.

export interface BasketBand {
  items: number
  orders: number
  share: number
  units: number
  revenue: number
}

export interface BasketProfile {
  totalOrders: number
  totalUnits: number
  averageBasket: number
  bands: BasketBand[]
  /** Share of orders taking every cover on offer — the Full Set attach rate. */
  fullSetShare: number | null
  multiCoverShare: number
}

export function basketProfile(orders: OrderRow[], coverCount?: number): BasketProfile {
  const live = sellable(orders)
  const byBand = new Map<number, BasketBand>()

  for (const o of live) {
    const items = unitsIn(o)
    if (items <= 0) continue
    const band = byBand.get(items) ?? { items, orders: 0, share: 0, units: 0, revenue: 0 }
    band.orders += 1
    band.units += items
    band.revenue += o.totalPrice
    byBand.set(items, band)
  }

  const totalOrders = [...byBand.values()].reduce((s, b) => s + b.orders, 0)
  const totalUnits = [...byBand.values()].reduce((s, b) => s + b.units, 0)
  const bands = [...byBand.values()]
    .sort((a, b) => a.items - b.items)
    .map((b) => ({ ...b, share: totalOrders > 0 ? (b.orders / totalOrders) * 100 : 0 }))

  const atLeast = (n: number) =>
    totalOrders > 0
      ? (bands.filter((b) => b.items >= n).reduce((s, b) => s + b.orders, 0) / totalOrders) * 100
      : 0

  return {
    totalOrders,
    totalUnits,
    averageBasket: totalOrders > 0 ? totalUnits / totalOrders : 0,
    bands,
    fullSetShare: coverCount && coverCount > 0 ? atLeast(coverCount) : null,
    multiCoverShare: atLeast(2),
  }
}

// ── Cover mix ───────────────────────────────────────────────────────────────
//
// Units sold per SKU. Compared against the share of the run each cover was
// given, this is what says a cover was under- or over-printed — the direct
// input to next year's RolloutCover.sharePct.

export interface CoverSale {
  sku: string
  title: string
  units: number
  revenue: number
  orders: number
  /** Share of all units sold. */
  soldSharePct: number
  /** Share of the print run this cover was given, when a plan is supplied. */
  plannedSharePct: number | null
  /** Positive means it sold harder than it was printed. */
  deltaPct: number | null
}

export function coverMix(
  orders: OrderRow[],
  plannedShares?: { sku: string; sharePct: number; name?: string }[]
): CoverSale[] {
  const bySku = new Map<string, { units: number; revenue: number; orders: Set<string>; title: string }>()

  for (const o of sellable(orders)) {
    for (const l of o.lineItems) {
      // A line with no SKU can't be attributed to a cover. Bucketed under a
      // visible placeholder rather than dropped, so the totals still tie and
      // the gap is obvious.
      const sku = l.sku?.trim() || '(no SKU)'
      const row = bySku.get(sku) ?? { units: 0, revenue: 0, orders: new Set<string>(), title: l.title }
      row.units += l.quantity
      row.revenue += l.price * l.quantity
      row.orders.add(o.id)
      bySku.set(sku, row)
    }
  }

  const totalUnits = [...bySku.values()].reduce((s, r) => s + r.units, 0)

  return [...bySku.entries()]
    .map(([sku, r]) => {
      const planned = plannedShares?.find((p) => p.sku === sku)?.sharePct ?? null
      const soldSharePct = totalUnits > 0 ? (r.units / totalUnits) * 100 : 0
      return {
        sku,
        title: plannedShares?.find((p) => p.sku === sku)?.name ?? r.title,
        units: r.units,
        revenue: r.revenue,
        orders: r.orders.size,
        soldSharePct,
        plannedSharePct: planned,
        deltaPct: planned == null ? null : soldSharePct - planned,
      }
    })
    .sort((a, b) => b.units - a.units)
}

// ── Territory demand ────────────────────────────────────────────────────────

// Grouped to match the rollout plan's territory names exactly, so demand can be
// read straight across against RolloutTerritory.b2cUnits.
const EU = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT',
  'NL','PL','PT','RO','SK','SI','ES','SE',
])
const SOUTH_AMERICA = new Set(['AR','BO','BR','CL','CO','EC','GY','PY','PE','SR','UY','VE'])
const APAC_ME = new Set([
  'JP','KR','CN','HK','TW','SG','MY','TH','VN','PH','ID','IN','AU','NZ',
  'AE','SA','QA','KW','BH','OM','IL','TR',
])

export function territoryForCountry(code: string | null): string {
  if (!code) return 'Unknown'
  const c = code.toUpperCase()
  if (c === 'US') return 'US'
  if (c === 'GB') return 'UK'
  if (c === 'CA') return 'Canada'
  if (EU.has(c)) return 'EU'
  if (SOUTH_AMERICA.has(c)) return 'South America'
  if (APAC_ME.has(c)) return 'Asia-Pacific / Middle East'
  return 'Rest of world'
}

export interface TerritoryDemand {
  territory: string
  orders: number
  units: number
  revenue: number
  soldSharePct: number
  plannedUnits: number | null
  plannedSharePct: number | null
  deltaPct: number | null
}

export function territoryDemand(
  orders: OrderRow[],
  planned?: { name: string; b2cUnits: number }[]
): TerritoryDemand[] {
  const map = new Map<string, { orders: number; units: number; revenue: number }>()

  for (const o of sellable(orders)) {
    const t = territoryForCountry(o.shipCountryCode)
    const row = map.get(t) ?? { orders: 0, units: 0, revenue: 0 }
    row.orders += 1
    row.units += unitsIn(o)
    row.revenue += o.totalPrice
    map.set(t, row)
  }

  const totalUnits = [...map.values()].reduce((s, r) => s + r.units, 0)
  const plannedTotal = planned?.reduce((s, p) => s + p.b2cUnits, 0) ?? 0

  return [...map.entries()]
    .map(([territory, r]) => {
      const p = planned?.find((x) => x.name === territory)
      const soldSharePct = totalUnits > 0 ? (r.units / totalUnits) * 100 : 0
      const plannedSharePct = p && plannedTotal > 0 ? (p.b2cUnits / plannedTotal) * 100 : null
      return {
        territory,
        orders: r.orders,
        units: r.units,
        revenue: r.revenue,
        soldSharePct,
        plannedUnits: p?.b2cUnits ?? null,
        plannedSharePct,
        deltaPct: plannedSharePct == null ? null : soldSharePct - plannedSharePct,
      }
    })
    .sort((a, b) => b.units - a.units)
}

// ── US coast split ──────────────────────────────────────────────────────────
//
// A proxy, and worth saying so: the rollout blends the New York and Los Angeles
// lane rates by an assumed 55% East Coast share, and this measures which coast
// US orders actually ship to. Mountain and Pacific states count as western,
// everything else eastern — the boundary is arbitrary in the middle, but the
// coasts are where the volume is.
const WESTERN_STATES = new Set(['WA','OR','CA','NV','ID','UT','AZ','MT','WY','CO','NM','AK','HI'])

export interface CoastSplit {
  usOrders: number
  east: number
  west: number
  unknown: number
  eastSharePct: number | null
  assumedEastSharePct: number | null
  deltaPct: number | null
}

export function coastSplit(orders: OrderRow[], assumedEastSharePct?: number): CoastSplit {
  let east = 0
  let west = 0
  let unknown = 0

  for (const o of sellable(orders)) {
    if ((o.shipCountryCode ?? '').toUpperCase() !== 'US') continue
    const st = (o.shipProvinceCode ?? '').toUpperCase()
    if (!st) unknown += 1
    else if (WESTERN_STATES.has(st)) west += 1
    else east += 1
  }

  const known = east + west
  const eastSharePct = known > 0 ? (east / known) * 100 : null
  return {
    usOrders: east + west + unknown,
    east,
    west,
    unknown,
    eastSharePct,
    assumedEastSharePct: assumedEastSharePct ?? null,
    deltaPct:
      eastSharePct != null && assumedEastSharePct != null ? eastSharePct - assumedEastSharePct : null,
  }
}

// ── Sales curve ─────────────────────────────────────────────────────────────
//
// How fast a drop sells. A cover that clears in hours was under-allocated; one
// still selling in week six was over-allocated. Bucketed by day since the first
// order rather than by calendar date, so separate years line up on one axis.

export interface CurvePoint {
  day: number
  date: string
  orders: number
  units: number
  cumulativeUnits: number
}

export function salesCurve(orders: OrderRow[], from?: Date, days = 60): CurvePoint[] {
  const live = sellable(orders)
    .map((o) => ({ ...o, at: asDate(o.orderedAt) }))
    .filter((o) => !Number.isNaN(o.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  if (live.length === 0) return []
  const origin = from ?? live[0].at
  const originDay = Date.UTC(origin.getUTCFullYear(), origin.getUTCMonth(), origin.getUTCDate())

  const byDay = new Map<number, { orders: number; units: number }>()
  for (const o of live) {
    const d = Math.floor(
      (Date.UTC(o.at.getUTCFullYear(), o.at.getUTCMonth(), o.at.getUTCDate()) - originDay) / 86_400_000
    )
    if (d < 0 || d > days) continue
    const row = byDay.get(d) ?? { orders: 0, units: 0 }
    row.orders += 1
    row.units += unitsIn(o)
    byDay.set(d, row)
  }

  let cumulative = 0
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, r]) => {
      cumulative += r.units
      return {
        day,
        date: new Date(originDay + day * 86_400_000).toISOString().slice(0, 10),
        orders: r.orders,
        units: r.units,
        cumulativeUnits: cumulative,
      }
    })
}

// ── Repeat buyers ───────────────────────────────────────────────────────────

export interface RepeatBuyers {
  identifiedCustomers: number
  repeat: number
  repeatSharePct: number | null
  guestOrders: number
}

export function repeatBuyers(orders: OrderRow[]): RepeatBuyers {
  const counts = new Map<string, number>()
  let guestOrders = 0

  for (const o of sellable(orders)) {
    if (!o.customerId) {
      guestOrders += 1
      continue
    }
    counts.set(o.customerId, (counts.get(o.customerId) ?? 0) + 1)
  }

  const identified = counts.size
  const repeat = [...counts.values()].filter((n) => n > 1).length
  return {
    identifiedCustomers: identified,
    repeat,
    repeatSharePct: identified > 0 ? (repeat / identified) * 100 : null,
    guestOrders,
  }
}

// ── Headline ────────────────────────────────────────────────────────────────

export interface Headline {
  orders: number
  units: number
  revenue: number
  shippingCollected: number
  averageOrderValue: number
  averageBasket: number
  currency: string
  firstOrderAt: string | null
  lastOrderAt: string | null
  excludedOrders: number
}

export function headline(orders: OrderRow[]): Headline {
  const live = sellable(orders)
  const revenue = live.reduce((s, o) => s + o.totalPrice, 0)
  const units = live.reduce((s, o) => s + unitsIn(o), 0)
  const dates = live
    .map((o) => asDate(o.orderedAt))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  return {
    orders: live.length,
    units,
    revenue,
    shippingCollected: live.reduce((s, o) => s + o.totalShipping, 0),
    averageOrderValue: live.length > 0 ? revenue / live.length : 0,
    averageBasket: live.length > 0 ? units / live.length : 0,
    currency: live[0]?.currency ?? 'GBP',
    firstOrderAt: dates[0]?.toISOString() ?? null,
    lastOrderAt: dates[dates.length - 1]?.toISOString() ?? null,
    excludedOrders: orders.length - live.length,
  }
}

// ── Recommendations ─────────────────────────────────────────────────────────
//
// Deliberately conservative. With one prior drop this is a single observation,
// not a trend, so every recommendation carries the evidence it rests on and the
// caller is expected to show it. A confident-sounding number off n=1 is worse
// than no number, because it gets acted on.

export interface Recommendation {
  input: string
  current: string
  observed: string
  suggestion: string
  /** How much weight to put on it — drives how loudly the UI states it. */
  confidence: 'directional' | 'indicative'
  rationale: string
}

export function recommendations(args: {
  covers: CoverSale[]
  territories: TerritoryDemand[]
  basket: BasketProfile
  coast: CoastSplit
  dropsObserved: number
}): Recommendation[] {
  const out: Recommendation[] = []
  const confidence = args.dropsObserved >= 2 ? 'indicative' : 'directional'
  const pct = (v: number) => `${v.toFixed(1)}%`

  // Only flag covers that moved materially against their allocation. A cover
  // within 3 points of plan is noise, not signal.
  for (const c of args.covers) {
    if (c.plannedSharePct == null || c.deltaPct == null) continue
    if (Math.abs(c.deltaPct) < 3) continue
    out.push({
      input: `Cover share — ${c.title}`,
      current: pct(c.plannedSharePct),
      observed: pct(c.soldSharePct),
      suggestion: `${c.deltaPct > 0 ? 'Increase' : 'Reduce'} toward ${pct(c.soldSharePct)}`,
      confidence,
      rationale:
        c.deltaPct > 0
          ? `Sold ${pct(Math.abs(c.deltaPct))} above its share of the run — it was under-printed.`
          : `Sold ${pct(Math.abs(c.deltaPct))} below its share of the run — it was over-printed.`,
    })
  }

  for (const t of args.territories) {
    if (t.plannedSharePct == null || t.deltaPct == null) continue
    if (Math.abs(t.deltaPct) < 5) continue
    out.push({
      input: `Territory B2C — ${t.territory}`,
      current: pct(t.plannedSharePct),
      observed: pct(t.soldSharePct),
      suggestion: `${t.deltaPct > 0 ? 'Allocate more to' : 'Allocate less to'} ${t.territory}`,
      confidence,
      rationale: `${t.units.toLocaleString()} units sold here, ${pct(Math.abs(t.deltaPct))} ${
        t.deltaPct > 0 ? 'above' : 'below'
      } its planned share.`,
    })
  }

  // The one that changes money rather than allocation.
  if (args.basket.totalOrders > 0) {
    out.push({
      input: 'Average basket (fulfilment economics)',
      current: 'assumed',
      observed: args.basket.averageBasket.toFixed(2),
      suggestion: `Price the scenarios on a basket of ${args.basket.averageBasket.toFixed(2)}`,
      confidence,
      rationale: `${pct(args.basket.multiCoverShare)} of orders took two or more covers${
        args.basket.fullSetShare != null ? `, ${pct(args.basket.fullSetShare)} took the full set` : ''
      }. The bundling saving in the rollout plan is only real to the extent this holds.`,
    })
  }

  if (args.coast.deltaPct != null && Math.abs(args.coast.deltaPct) >= 5) {
    out.push({
      input: 'East Coast share (US lane blend)',
      current: pct(args.coast.assumedEastSharePct ?? 0),
      observed: pct(args.coast.eastSharePct ?? 0),
      suggestion: `Set East Coast share to ${pct(args.coast.eastSharePct ?? 0)}`,
      confidence,
      rationale: `${args.coast.east} of ${args.coast.east + args.coast.west} US orders with a known state shipped east.`,
    })
  }

  return out
}
