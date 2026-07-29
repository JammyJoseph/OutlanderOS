// ═══════════════════════════════════════════════════════════════════════════
// Rollout & distribution — every derived figure in one place.
//
// The spreadsheet this replaces colour-codes cells: blue = you type it,
// black = it's calculated, green = it comes from another tab. That distinction
// is the whole design. Only blue cells are database columns; everything black
// or green is computed here, on read.
//
// The alternative — storing cover splits per store, per-hub totals and channel
// subtotals — means every one of those numbers can drift from the rows beneath
// it, and you find out when the printer ships the wrong cartons.
// ═══════════════════════════════════════════════════════════════════════════

export interface CoverInput {
  id: string
  name: string
  sku: string
  sharePct: number
  isBalancer: boolean
  sortOrder: number
}

export interface ProfileInput {
  id: string
  name: string
  splits: Record<string, number> // cover name → percentage
  isDefault: boolean
}

export interface HubInput {
  id: string
  name: string
  location: string | null
  serves: string | null
  isDirect: boolean
  sortOrder: number
}

export interface ChannelInput {
  id: string
  name: string
  units: number
  purpose: string | null
  hubId: string | null
  kind: string
  sortOrder: number
}

export interface TerritoryInput {
  id: string
  name: string
  hubId: string | null
  phase1: number
  phase2: number
  seedingVip: number
  sortOrder: number
}

export interface StockistInput {
  id: string
  name: string
  city: string | null
  market: string | null
  hubId: string | null
  profileId: string | null
  units: number
  sortOrder: number
}

export interface EventInput {
  id: string
  city: string
  hubId: string | null
  units: number
  sortOrder: number
}

export interface LaneInput {
  id: string
  name: string
  ratePerOrder: number | null
  currency: string
  volume: number
  quoteStatus: string | null
  isBaseline: boolean
  sortOrder: number
}

export interface PlanInput {
  totalPrintRun: number
  launchDate: Date | string | null
  warehouseDeadline: Date | string | null
  gbpToUsd: number
  eastCoastShare: number
  covers: CoverInput[]
  profiles: ProfileInput[]
  hubs: HubInput[]
  channels: ChannelInput[]
  territories: TerritoryInput[]
  stockists: StockistInput[]
  events: EventInput[]
  lanes: LaneInput[]
}

// ── Splitting with a balancer ───────────────────────────────────────────────
//
// Percentages of an integer never divide cleanly. Rounding each independently
// leaves the columns a unit or two short of the total, and in a print run that
// means cartons that don't tie. One designated row absorbs the remainder, so
// the split always sums to exactly the input.
export function splitWithBalancer(
  total: number,
  parts: { key: string; pct: number; isBalancer: boolean }[]
): Record<string, number> {
  const out: Record<string, number> = {}
  if (parts.length === 0) return out

  const balancerIdx = parts.findIndex((p) => p.isBalancer)
  // No balancer marked — fall back to the last row so the total still ties.
  const absorbIdx = balancerIdx >= 0 ? balancerIdx : parts.length - 1

  let running = 0
  parts.forEach((p, i) => {
    if (i === absorbIdx) return
    const v = Math.round((total * p.pct) / 100)
    out[p.key] = v
    running += v
  })
  out[parts[absorbIdx].key] = total - running
  return out
}

// ── Cover master ────────────────────────────────────────────────────────────

export interface CoverUnits {
  cover: CoverInput
  units: number
}

export function coverUnits(plan: PlanInput): CoverUnits[] {
  const split = splitWithBalancer(
    plan.totalPrintRun,
    plan.covers.map((c) => ({ key: c.id, pct: c.sharePct, isBalancer: c.isBalancer }))
  )
  return plan.covers.map((c) => ({ cover: c, units: split[c.id] ?? 0 }))
}

// ── Channel × cover grid ────────────────────────────────────────────────────
// Each channel's units split by the cover master's percentages.

export function channelCoverGrid(
  plan: PlanInput
): { channel: ChannelInput; byCover: Record<string, number> }[] {
  const parts = plan.covers.map((c) => ({ key: c.id, pct: c.sharePct, isBalancer: c.isBalancer }))
  return plan.channels.map((ch) => ({
    channel: ch,
    byCover: splitWithBalancer(ch.units, parts),
  }))
}

// ── Stockist × cover grid ───────────────────────────────────────────────────
// Each store's units split by its assigned cover profile. The balancer cover
// absorbs rounding on every row.

export function stockistCoverSplit(
  stockist: StockistInput,
  plan: PlanInput
): Record<string, number> {
  const profile =
    plan.profiles.find((p) => p.id === stockist.profileId) ??
    plan.profiles.find((p) => p.isDefault) ??
    plan.profiles[0]

  const parts = plan.covers.map((c) => ({
    key: c.id,
    // Profiles are keyed by cover NAME so adding a cover doesn't need a
    // migration; fall back to the cover's own share when the profile is silent.
    pct: profile?.splits?.[c.name] ?? c.sharePct,
    isBalancer: c.isBalancer,
  }))
  return splitWithBalancer(stockist.units, parts)
}

export function stockistCoverTotals(plan: PlanInput): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const c of plan.covers) totals[c.id] = 0
  for (const s of plan.stockists) {
    const split = stockistCoverSplit(s, plan)
    for (const c of plan.covers) totals[c.id] += split[c.id] ?? 0
  }
  return totals
}

// ── Regional warehouse model ────────────────────────────────────────────────
//
// Derived entirely: a hub holds whatever routes to it. Storing these totals
// would let the warehouse table disagree with the rows that feed it.

export interface HubTotals {
  hub: HubInput
  b2cAndGifting: number
  events: number
  stockists: number
  reserveAndBuffer: number
  total: number
  sharePct: number
}

export function hubTotals(plan: PlanInput): HubTotals[] {
  const rows = plan.hubs.map((hub) => {
    const b2cAndGifting = plan.territories
      .filter((t) => t.hubId === hub.id)
      .reduce((s, t) => s + t.phase1 + t.phase2 + t.seedingVip, 0)
    const events = plan.events.filter((e) => e.hubId === hub.id).reduce((s, e) => s + e.units, 0)
    const stockists = plan.stockists
      .filter((st) => st.hubId === hub.id)
      .reduce((s, st) => s + st.units, 0)
    // Channels pinned to a hub. Two cases, and conflating them double-counts:
    //
    //  • BUFFER — the whole allocation sits here (archive, replacements).
    //  • B2B — only the part NOT yet given to a stockist sits here. The rest is
    //    already counted in `stockists` above. This is the uncommitted reserve
    //    held back for secondary selects, and it has to be somewhere physical or
    //    the warehouse model won't tie to the print run.
    const reserveAndBuffer = plan.channels
      .filter((c) => c.hubId === hub.id)
      .reduce((s, c) => {
        if (c.kind !== 'B2B') return s + c.units
        const allocated = plan.stockists.reduce((n, st) => n + st.units, 0)
        return s + Math.max(0, c.units - allocated)
      }, 0)
    const total = b2cAndGifting + events + stockists + reserveAndBuffer
    return { hub, b2cAndGifting, events, stockists, reserveAndBuffer, total, sharePct: 0 }
  })
  const grand = rows.reduce((s, r) => s + r.total, 0)
  return rows.map((r) => ({ ...r, sharePct: grand > 0 ? (r.total / grand) * 100 : 0 }))
}

// ── US shipping economics ───────────────────────────────────────────────────

export interface UsEconomics {
  baselineGbp: number | null
  baselineUsd: number | null
  blendedUsd: number | null
  blendedGbp: number | null
  savingPerOrderUsd: number | null
  savingPerOrderGbp: number | null
  usVolume: number
  totalSavingUsd: number | null
  totalSavingGbp: number | null
}

// `usTerritoryNames` decides which territories count as US volume — passed in
// rather than guessed from the name, so renaming a territory can't silently
// change the headline saving.
export function usEconomics(
  plan: PlanInput,
  opts: { baselineLaneId?: string; nyLaneId?: string; laLaneId?: string; usTerritoryNames?: string[] } = {}
): UsEconomics {
  const lane = (id?: string) => plan.lanes.find((l) => l.id === id)
  const baseline = lane(opts.baselineLaneId) ?? plan.lanes.find((l) => l.isBaseline)
  const ny = lane(opts.nyLaneId)
  const la = lane(opts.laLaneId)

  const toUsd = (v: number, ccy: string) => (ccy === 'GBP' ? v * plan.gbpToUsd : v)
  const toGbp = (v: number, ccy: string) => (ccy === 'GBP' ? v : v / plan.gbpToUsd)

  const baselineUsd = baseline?.ratePerOrder != null ? toUsd(baseline.ratePerOrder, baseline.currency) : null
  const baselineGbp = baseline?.ratePerOrder != null ? toGbp(baseline.ratePerOrder, baseline.currency) : null

  let blendedUsd: number | null = null
  if (ny?.ratePerOrder != null && la?.ratePerOrder != null) {
    const share = plan.eastCoastShare / 100
    blendedUsd = toUsd(ny.ratePerOrder, ny.currency) * share + toUsd(la.ratePerOrder, la.currency) * (1 - share)
  }
  const blendedGbp = blendedUsd != null ? blendedUsd / plan.gbpToUsd : null

  const savingPerOrderUsd = baselineUsd != null && blendedUsd != null ? baselineUsd - blendedUsd : null
  const savingPerOrderGbp = savingPerOrderUsd != null ? savingPerOrderUsd / plan.gbpToUsd : null

  const names = opts.usTerritoryNames ?? ['US']
  const usVolume = plan.territories
    .filter((t) => names.includes(t.name))
    .reduce((s, t) => s + t.phase1 + t.phase2 + t.seedingVip, 0)

  return {
    baselineGbp,
    baselineUsd,
    blendedUsd,
    blendedGbp,
    savingPerOrderUsd,
    savingPerOrderGbp,
    usVolume,
    totalSavingUsd: savingPerOrderUsd != null ? savingPerOrderUsd * usVolume : null,
    totalSavingGbp: savingPerOrderGbp != null ? savingPerOrderGbp * usVolume : null,
  }
}

// ── Reconciliation ──────────────────────────────────────────────────────────
//
// The point of the whole exercise: every allocation must tie back to the print
// run. A check that can't be computed (because a rate hasn't been quoted, say)
// reports `null` rather than zero — "not yet known" and "reconciles to zero"
// are very different answers and must not look alike.

export interface Check {
  label: string
  result: number
  target: number
  variance: number
  ok: boolean
  note?: string
}

export function reconcile(plan: PlanInput): Check[] {
  const checks: Check[] = []
  const run = plan.totalPrintRun

  const covers = coverUnits(plan)
  const coverTotal = covers.reduce((s, c) => s + c.units, 0)
  checks.push({
    label: 'Cover split vs print run',
    result: coverTotal,
    target: run,
    variance: coverTotal - run,
    ok: coverTotal === run,
  })

  const channelTotal = plan.channels.reduce((s, c) => s + c.units, 0)
  checks.push({
    label: 'Channel allocation vs print run',
    result: channelTotal,
    target: run,
    variance: channelTotal - run,
    ok: channelTotal === run,
    note: 'Every unit in the run must be allocated to a channel.',
  })

  // B2C territory demand must match the channels that feed it.
  const b2cChannels = plan.channels
    .filter((c) => c.kind === 'B2C' || c.kind === 'SEEDING')
    .reduce((s, c) => s + c.units, 0)
  const territoryTotal = plan.territories.reduce(
    (s, t) => s + t.phase1 + t.phase2 + t.seedingVip,
    0
  )
  checks.push({
    label: 'Territory split vs B2C + seeding channels',
    result: territoryTotal,
    target: b2cChannels,
    variance: territoryTotal - b2cChannels,
    ok: territoryTotal === b2cChannels,
    note: 'This is the volume to quote for individual-order fulfilment.',
  })

  const eventChannel = plan.channels.filter((c) => c.kind === 'EVENTS').reduce((s, c) => s + c.units, 0)
  const eventTotal = plan.events.reduce((s, e) => s + e.units, 0)
  checks.push({
    label: 'Event cities vs launch-event channel',
    result: eventTotal,
    target: eventChannel,
    variance: eventTotal - eventChannel,
    ok: eventTotal === eventChannel,
  })

  const b2bChannel = plan.channels.filter((c) => c.kind === 'B2B').reduce((s, c) => s + c.units, 0)
  const stockistTotal = plan.stockists.reduce((s, st) => s + st.units, 0)
  checks.push({
    label: 'Stockists allocated vs B2B budget',
    result: stockistTotal,
    target: b2bChannel,
    variance: stockistTotal - b2bChannel,
    // Under-allocation is expected and healthy — it's the reserve.
    ok: stockistTotal <= b2bChannel,
    note:
      stockistTotal < b2bChannel
        ? `${(b2bChannel - stockistTotal).toLocaleString()} units held in reserve for secondary selects.`
        : undefined,
  })

  const hubs = hubTotals(plan)
  const hubGrand = hubs.reduce((s, h) => s + h.total, 0)
  checks.push({
    label: 'Warehouse model vs print run',
    result: hubGrand,
    target: run,
    variance: hubGrand - run,
    ok: hubGrand === run,
    note: 'Every unit must be physically somewhere.',
  })

  // Cover columns across stockists must tie to the units allocated.
  const stockCovers = stockistCoverTotals(plan)
  const stockCoverSum = Object.values(stockCovers).reduce((s, v) => s + v, 0)
  checks.push({
    label: 'Stockist cover columns vs units allocated',
    result: stockCoverSum,
    target: stockistTotal,
    variance: stockCoverSum - stockistTotal,
    ok: stockCoverSum === stockistTotal,
  })

  return checks
}

// ── Countdown ───────────────────────────────────────────────────────────────
//
// `today` is injected rather than read from the clock so the same plan renders
// identically on the server and the client — a countdown computed twice from
// Date.now() flickers on hydration.
export function daysBetween(from: Date, to: Date | string | null): number | null {
  if (!to) return null
  const target = typeof to === 'string' ? new Date(to) : to
  if (Number.isNaN(target.getTime())) return null
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((b - a) / 86_400_000)
}

export const MILESTONE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]

export const MILESTONE_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  BLOCKED: 'Blocked',
}

export const CHANNEL_KINDS = ['B2C', 'B2B', 'SEEDING', 'EVENTS', 'BUFFER'] as const
