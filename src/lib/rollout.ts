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
  subject: string | null
  sku: string
  sharePct: number
  isBalancer: boolean
  dropId: string | null
  sortOrder: number
}

// A release date, not a delivery date — see the model comment in schema.prisma.
export interface DropInput {
  id: string
  name: string
  goLiveAt: Date | string
  sharePct: number
  isBalancer: boolean
  notes: string | null
  sortOrder: number
}

export interface WaveInput {
  id: string
  name: string
  tier: string
  inStoreByOverride: Date | string | null
  dispatchByOverride: Date | string | null
  isEmbargoed: boolean
  notes: string | null
  sortOrder: number
}

export interface RateCardInput {
  id: string
  hubId: string | null
  currency: string
  orderFee: number
  itemPick: number
  runningCost: number
  isPlaceholder: boolean
  source: string | null
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
  b2cUnits: number
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
  tier: string
  isReserved: boolean
  embargoStatus: string | null
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
  isPlaceholder: boolean
  isBaseline: boolean
  sortOrder: number
}

export interface PlanInput {
  totalPrintRun: number
  launchDate: Date | string | null
  warehouseDeadline: Date | string | null
  gbpToUsd: number
  eurToUsd: number
  eastCoastShare: number
  shippingUpliftPct: number
  b2bFreightPerShipment: number
  usHubRunningCost: number
  lastYearUsRateGbp: number
  printCompleteDate: Date | string | null
  leadTimeWeeks: number
  promoDaysBeforeDrop1: number
  widerDaysAfterLastDrop: number
  hubToStoreTransitDays: number
  covers: CoverInput[]
  drops: DropInput[]
  waves: WaveInput[]
  rateCards: RateCardInput[]
  profiles: ProfileInput[]
  hubs: HubInput[]
  channels: ChannelInput[]
  territories: TerritoryInput[]
  stockists: StockistInput[]
  events: EventInput[]
  lanes: LaneInput[]
}

// ── Money ───────────────────────────────────────────────────────────────────
// Every economic figure resolves to USD before it's compared, because the rate
// cards are quoted in three currencies and a mixed-currency total is a wrong
// number that looks right.
export function toUsd(v: number, ccy: string, plan: Pick<PlanInput, 'gbpToUsd' | 'eurToUsd'>) {
  if (ccy === 'GBP') return v * plan.gbpToUsd
  if (ccy === 'EUR') return v * plan.eurToUsd
  return v
}

export const CURRENCY_SYMBOL: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }

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

// ── Drop schedule ───────────────────────────────────────────────────────────
//
// Three staggered release dates, one physical shipment. Every B2C unit reaches
// the warehouses before the first drop; a drop only decides when a cover becomes
// buyable. `unitsLive` is what the store can sell that day; `cumulativeLive` is
// what it can sell in total by then.

export interface DropRow {
  drop: DropInput
  covers: CoverInput[]
  unitsLive: number
  cumulativeLive: number
  // Stockist units already sitting on shelves when this drop goes live. Non-zero
  // only for drops that fall after an embargoed wave has landed — this is the
  // leak exposure, and it's the number the wave design is trading against.
  stockistUnitsInStore: number
  goLiveAt: Date
}

const asDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null
  const d = typeof v === 'string' ? new Date(v) : v
  return Number.isNaN(d.getTime()) ? null : d
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

/** B2C pool: the channels that feed individual orders, excluding B2B and events. */
export function b2cPool(plan: PlanInput): number {
  return plan.channels.filter((c) => c.kind === 'B2C').reduce((s, c) => s + c.units, 0)
}

export function dropSchedule(plan: PlanInput): DropRow[] {
  const drops = [...plan.drops].sort((a, b) => a.sortOrder - b.sortOrder)
  const split = splitWithBalancer(
    b2cPool(plan),
    drops.map((d) => ({ key: d.id, pct: d.sharePct, isBalancer: d.isBalancer }))
  )

  const waves = waveSchedule(plan)
  let cumulative = 0

  return drops.map((drop) => {
    const unitsLive = split[drop.id] ?? 0
    cumulative += unitsLive
    const goLiveAt = asDate(drop.goLiveAt) ?? new Date(0)
    // A wave's stock is in store — and therefore leakable — from its in-store
    // date onwards.
    const stockistUnitsInStore = waves
      .filter((w) => w.inStoreBy != null && w.inStoreBy <= goLiveAt)
      .reduce((s, w) => s + w.units, 0)

    return {
      drop,
      covers: plan.covers.filter((c) => c.dropId === drop.id).sort((a, b) => a.sortOrder - b.sortOrder),
      unitsLive,
      cumulativeLive: cumulative,
      stockistUnitsInStore,
      goLiveAt,
    }
  })
}

/**
 * Per-territory hold for each drop. Derived, never stored: the sheet's
 * "held for Drop 1/2/3" columns are `b2cUnits × drop share`, and storing them
 * would let a territory's holds disagree with the drop schedule the moment
 * someone moves a share.
 */
export function territoryDropHolds(plan: PlanInput): Record<string, Record<string, number>> {
  const drops = [...plan.drops].sort((a, b) => a.sortOrder - b.sortOrder)
  const parts = drops.map((d) => ({ key: d.id, pct: d.sharePct, isBalancer: d.isBalancer }))
  const out: Record<string, Record<string, number>> = {}
  for (const t of plan.territories) out[t.id] = splitWithBalancer(t.b2cUnits, parts)
  return out
}

// ── Stockist waves ──────────────────────────────────────────────────────────
//
// One delivery per store. Wave membership follows from the store's tier, and
// both dates follow from the drop schedule and the plan's clock inputs — so
// moving a drop moves the dispatch date rather than leaving a stale one behind.

export interface WaveRow {
  wave: WaveInput
  stockists: StockistInput[]
  stores: number
  units: number
  /** Reserved slots hold no stock, so they are not a delivery to pay freight on. */
  shipments: number
  inStoreBy: Date | null
  dispatchBy: Date | null
  /** Days the store sits on embargoed stock before the last cover is public. */
  embargoDays: number | null
  isDerivedInStore: boolean
  embargoSigned: number
  embargoOutstanding: number
}

export function waveSchedule(plan: PlanInput): WaveRow[] {
  const drops = [...plan.drops].sort((a, b) => a.sortOrder - b.sortOrder)
  const firstDrop = asDate(drops[0]?.goLiveAt)
  const lastDrop = asDate(drops[drops.length - 1]?.goLiveAt)

  return [...plan.waves]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((wave) => {
      const stockists = plan.stockists.filter((s) => s.tier === wave.tier)
      const trading = stockists.filter((s) => !s.isReserved)

      const override = asDate(wave.inStoreByOverride)
      // Promo lands a set number of days BEFORE the first cover is public;
      // the wider wave lands after the last one, when nothing can leak.
      const derived = wave.isEmbargoed
        ? firstDrop
          ? addDays(firstDrop, -plan.promoDaysBeforeDrop1)
          : null
        : lastDrop
          ? addDays(lastDrop, plan.widerDaysAfterLastDrop)
          : null
      const inStoreBy = override ?? derived

      const dispatchOverride = asDate(wave.dispatchByOverride)
      const dispatchBy =
        dispatchOverride ?? (inStoreBy ? addDays(inStoreBy, -plan.hubToStoreTransitDays) : null)

      // Exposure runs until every cover is public, not until the first drop —
      // stock is only safe once there's nothing left to reveal.
      const embargoDays =
        wave.isEmbargoed && inStoreBy && lastDrop
          ? Math.max(0, Math.round((lastDrop.getTime() - inStoreBy.getTime()) / 86_400_000))
          : null

      return {
        wave,
        stockists,
        stores: trading.length,
        units: stockists.reduce((s, st) => s + st.units, 0),
        shipments: trading.length,
        inStoreBy,
        dispatchBy,
        embargoDays,
        isDerivedInStore: override == null,
        embargoSigned: wave.isEmbargoed
          ? trading.filter((s) => s.embargoStatus === 'SIGNED').length
          : 0,
        embargoOutstanding: wave.isEmbargoed
          ? trading.filter((s) => s.embargoStatus !== 'SIGNED').length
          : 0,
      }
    })
}

// ── The print-to-stockist clock ─────────────────────────────────────────────
//
// The constraint that decides whether the plan is possible at all. Print
// completion plus the printer's lead time gives the earliest date anything can
// be in a store. If the first wave needs to land before that, the print date has
// to move — and this is the number that says so, in days, before it's too late.

export interface PrintClock {
  printCompleteDate: Date | null
  leadTimeWeeks: number
  earliestInStore: Date | null
  firstWaveInStore: Date | null
  /** Days of slack. Negative means the schedule is impossible as planned. */
  headroomDays: number | null
  feasible: boolean | null
}

export function printClock(plan: PlanInput): PrintClock {
  const printCompleteDate = asDate(plan.printCompleteDate)
  const earliestInStore = printCompleteDate
    ? addDays(printCompleteDate, Math.round(plan.leadTimeWeeks * 7))
    : null

  const waves = waveSchedule(plan)
  const dated = waves.filter((w) => w.inStoreBy != null)
  const firstWaveInStore = dated.length
    ? dated.reduce((a, b) => (a.inStoreBy! <= b.inStoreBy! ? a : b)).inStoreBy
    : null

  const headroomDays =
    earliestInStore && firstWaveInStore
      ? Math.round((firstWaveInStore.getTime() - earliestInStore.getTime()) / 86_400_000)
      : null

  return {
    printCompleteDate,
    leadTimeWeeks: plan.leadTimeWeeks,
    earliestInStore,
    firstWaveInStore,
    headroomDays,
    feasible: headroomDays == null ? null : headroomDays >= 0,
  }
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
      .reduce((s, t) => s + t.b2cUnits + t.seedingVip, 0)
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
    .reduce((s, t) => s + t.b2cUnits + t.seedingVip, 0)

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

// ═══════════════════════════════════════════════════════════════════════════
// Fulfilment economics
//
// The asymmetry that drives everything here: shipping is charged per PARCEL,
// picking is charged per MAGAZINE. So a customer buying four covers in one
// order pays one shipping fee, not four — and three staggered drops, left
// alone, push that same customer into three separate parcels.
//
// Every figure resolves to USD before comparison. Rates are never rounded
// before multiplying by volume; rounding a blended lane to the cent and then
// multiplying by 1,960 moves the answer by ten dollars.
// ═══════════════════════════════════════════════════════════════════════════

export function rateCardFor(plan: PlanInput, hubId: string | null): RateCardInput | null {
  return plan.rateCards.find((r) => r.hubId === hubId) ?? null
}

export function laneUsd(plan: PlanInput, lane: LaneInput | undefined): number | null {
  if (!lane || lane.ratePerOrder == null) return null
  return toUsd(lane.ratePerOrder, lane.currency, plan)
}

/**
 * The US lane is a weighted average of the two coasts, because orders aren't
 * quoted per destination — one blended figure is what the model prices against.
 */
export function blendedUsLaneUsd(
  plan: PlanInput,
  opts: { nyLaneId?: string; laLaneId?: string } = {}
): number | null {
  const ny = laneUsd(plan, plan.lanes.find((l) => l.id === opts.nyLaneId))
  const la = laneUsd(plan, plan.lanes.find((l) => l.id === opts.laLaneId))
  if (ny == null || la == null) return null
  const share = plan.eastCoastShare / 100
  return ny * share + la * (1 - share)
}

export interface BasketRow {
  items: number
  shippingUsd: number
  pickUsd: number
  totalUsd: number
  perMagazineUsd: number
  /** What the same magazines cost bought one parcel at a time. */
  ifBoughtSeparatelyUsd: number
  savedUsd: number
}

/**
 * Cost of one order containing `items` magazines. `shippingUpliftPct` is the
 * extra charged per additional magazine in the same parcel — 0 means the parcel
 * rate is genuinely flat, which is the aggressive case and the strongest form
 * of the bundling argument. Raise it the moment a carrier prices by weight.
 */
export function basketEconomics(
  plan: PlanInput,
  laneUsdRate: number | null,
  card: RateCardInput | null,
  maxItems = 4
): BasketRow[] {
  if (laneUsdRate == null || !card) return []
  const orderFee = toUsd(card.orderFee, card.currency, plan)
  const itemPick = toUsd(card.itemPick, card.currency, plan)

  const cost = (items: number) => {
    const shipping = laneUsdRate * (1 + (plan.shippingUpliftPct / 100) * (items - 1))
    const pick = orderFee + itemPick * items
    return { shipping, pick, total: shipping + pick }
  }

  const single = cost(1).total
  const rows: BasketRow[] = []
  for (let items = 1; items <= maxItems; items++) {
    const c = cost(items)
    rows.push({
      items,
      shippingUsd: c.shipping,
      pickUsd: c.pick,
      totalUsd: c.total,
      perMagazineUsd: c.total / items,
      ifBoughtSeparatelyUsd: single * items,
      savedUsd: single * items - c.total,
    })
  }
  return rows
}

export interface ScenarioRow {
  label: string
  itemsPerOrder: number
  orders: number
  units: number
  costUsd: number
  costPerOrderUsd: number
  savedVsWorstUsd: number
}

/**
 * What the US B2C pool costs to fulfil at different average basket sizes. The
 * worst case isn't a pessimistic guess — it's what happens if nothing is done to
 * encourage bundling, given three separate release dates.
 */
export function scenarioCosts(
  plan: PlanInput,
  usVolume: number,
  basket: BasketRow[]
): ScenarioRow[] {
  if (!basket.length || usVolume <= 0) return []
  const labels: Record<number, string> = {
    1: 'Everyone buys one copy at a time',
    2: 'Average basket of two covers',
    3: 'Average basket of three covers',
    4: 'Every customer takes the Full Set',
  }
  const worst = basket[0].totalUsd * usVolume

  return basket.map((b) => {
    const orders = usVolume / b.items
    const costUsd = orders * b.totalUsd
    return {
      label: labels[b.items] ?? `Average basket of ${b.items}`,
      itemsPerOrder: b.items,
      orders,
      units: usVolume,
      costUsd,
      costPerOrderUsd: b.totalUsd,
      savedVsWorstUsd: worst - costUsd,
    }
  })
}

export interface YearOnYear {
  lastYearPerOrderUsd: number | null
  thisYearPerOrderUsd: number | null
  usVolume: number
  lastYearTotalUsd: number | null
  thisYearTotalUsd: number | null
  warehouseSavingUsd: number | null
  bundlingUpsideUsd: number | null
  totalSavingUsd: number | null
  totalSavingPerOrderUsd: number | null
}

/**
 * Last year every US order shipped from the UK, so the comparator is last year's
 * freight PLUS the UK rate card — they picked and packed in Britain too.
 * Comparing bare freight against this year's all-in cost would overstate the
 * saving, which is the easiest way to make a real win look like a fake one.
 */
export function yearOnYear(
  plan: PlanInput,
  usVolume: number,
  basket: BasketRow[],
  bundledScenario?: ScenarioRow
): YearOnYear {
  const ukCard = plan.rateCards.find((r) => r.currency === 'GBP') ?? null
  const lastYearPerOrderUsd = ukCard
    ? toUsd(plan.lastYearUsRateGbp + ukCard.orderFee + ukCard.itemPick, 'GBP', plan)
    : toUsd(plan.lastYearUsRateGbp, 'GBP', plan)

  const thisYearPerOrderUsd = basket.length ? basket[0].totalUsd : null

  const lastYearTotalUsd = lastYearPerOrderUsd * usVolume
  const thisYearTotalUsd = thisYearPerOrderUsd != null ? thisYearPerOrderUsd * usVolume : null

  const warehouseSavingUsd =
    thisYearTotalUsd != null ? lastYearTotalUsd - thisYearTotalUsd - plan.usHubRunningCost : null
  const bundlingUpsideUsd = bundledScenario?.savedVsWorstUsd ?? null

  const totalSavingUsd =
    warehouseSavingUsd != null ? warehouseSavingUsd + (bundlingUpsideUsd ?? 0) : null

  return {
    lastYearPerOrderUsd,
    thisYearPerOrderUsd,
    usVolume,
    lastYearTotalUsd,
    thisYearTotalUsd,
    warehouseSavingUsd,
    bundlingUpsideUsd,
    totalSavingUsd,
    totalSavingPerOrderUsd: totalSavingUsd != null && usVolume > 0 ? totalSavingUsd / usVolume : null,
  }
}

export interface StockistFreight {
  shipments: number
  costUsd: number
  /** What it would cost to deliver to every store once per drop instead. */
  perDropShipments: number
  perDropCostUsd: number
  savedUsd: number
  ratePerShipmentUsd: number
}

/**
 * The freight consequence of the wave design. One delivery per store against one
 * per store per drop — the comparison that justifies holding embargoed stock,
 * and the reason the two numbers belong on the same screen as the embargo days.
 */
export function stockistFreight(plan: PlanInput): StockistFreight {
  const waves = waveSchedule(plan)
  const shipments = waves.reduce((s, w) => s + w.shipments, 0)
  const stores = plan.stockists.filter((s) => !s.isReserved).length
  const drops = plan.drops.length || 1
  const rate = plan.b2bFreightPerShipment

  const perDropShipments = stores * drops
  return {
    shipments,
    costUsd: shipments * rate,
    perDropShipments,
    perDropCostUsd: perDropShipments * rate,
    savedUsd: (perDropShipments - shipments) * rate,
    ratePerShipmentUsd: rate,
  }
}

/**
 * Every figure still resting on an unquoted rate. The headline saving is only as
 * firm as its inputs, and a placeholder that reads like a quote is how a plan
 * gets approved on numbers nobody has actually been given.
 */
export function placeholderAudit(plan: PlanInput): { total: number; items: string[] } {
  const items: string[] = []
  for (const l of plan.lanes) if (l.isPlaceholder) items.push(`Lane — ${l.name}`)
  for (const r of plan.rateCards) {
    if (!r.isPlaceholder) continue
    const hub = plan.hubs.find((h) => h.id === r.hubId)
    items.push(`Rate card — ${hub?.name ?? r.currency}`)
  }
  return { total: items.length, items }
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
  const territoryTotal = plan.territories.reduce((s, t) => s + t.b2cUnits + t.seedingVip, 0)
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

  // ── Drops and waves ───────────────────────────────────────────────────────

  const drops = dropSchedule(plan)
  const dropTotal = drops.reduce((s, d) => s + d.unitsLive, 0)
  const pool = b2cPool(plan)
  checks.push({
    label: 'Drop releases vs B2C pool',
    result: dropTotal,
    target: pool,
    variance: dropTotal - pool,
    ok: dropTotal === pool,
    note: 'Every B2C unit must be released in exactly one drop.',
  })

  const uncovered = plan.covers.filter((c) => !c.dropId)
  if (uncovered.length > 0) {
    checks.push({
      label: 'Covers assigned to a drop',
      result: plan.covers.length - uncovered.length,
      target: plan.covers.length,
      variance: -uncovered.length,
      ok: false,
      note: `${uncovered.map((c) => c.name).join(', ')} would never go on sale.`,
    })
  }

  const waves = waveSchedule(plan)
  const waveUnits = waves.reduce((s, w) => s + w.units, 0)
  checks.push({
    label: 'Wave units vs units allocated',
    result: waveUnits,
    target: stockistTotal,
    variance: waveUnits - stockistTotal,
    ok: waveUnits === stockistTotal,
    note: 'A store whose tier matches no wave has stock but no delivery date.',
  })

  // The promo list is deliberately small: every extra account is another party
  // holding the magazine before it's public.
  const promo = waves.find((w) => w.wave.isEmbargoed)
  if (promo) {
    const MIN = 10
    const MAX = 15
    checks.push({
      label: 'Promo accounts within agreed range',
      result: promo.stores,
      target: MAX,
      variance: promo.stores > MAX ? promo.stores - MAX : promo.stores < MIN ? promo.stores - MIN : 0,
      ok: promo.stores >= MIN && promo.stores <= MAX,
      note: `${MIN}–${MAX} accounts. Each one holds embargoed stock for ${promo.embargoDays ?? '—'} days.`,
    })

    if (promo.embargoOutstanding > 0) {
      checks.push({
        label: 'Signed embargo agreements',
        result: promo.embargoSigned,
        target: promo.stores,
        variance: -promo.embargoOutstanding,
        ok: false,
        note: `${promo.embargoOutstanding} account(s) have no signed agreement on file. The wave cannot dispatch until they do.`,
      })
    }
  }

  // The printer stocks every brick-and-mortar account worldwide, straight off
  // the print floor, so no stockist carton should pass through a regional
  // warehouse. The store's hub is a dropdown, so this is one reassignment away
  // from being quietly untrue — and it would inflate the regional warehouse
  // count with stock those warehouses never see.
  const misrouted = plan.stockists.filter((s) => {
    if (s.isReserved || s.units === 0) return false
    const hub = plan.hubs.find((h) => h.id === s.hubId)
    return hub != null && !hub.isDirect
  })
  if (plan.hubs.some((h) => h.isDirect)) {
    const units = misrouted.reduce((s, x) => s + x.units, 0)
    checks.push({
      label: 'Stockist stock routed via a warehouse',
      result: units,
      target: 0,
      variance: units,
      ok: units === 0,
      note:
        units === 0
          ? 'Every stockist ships direct from the printer.'
          : `${misrouted.length} account(s) are routed via a regional warehouse. Move them to the direct hub, or the warehouse model counts stock that never arrives.`,
    })
  }

  // The clock. Not an allocation check — a feasibility one. Negative headroom
  // means the plan cannot happen, and no amount of correct arithmetic elsewhere
  // fixes it.
  const clock = printClock(plan)
  if (clock.headroomDays != null) {
    checks.push({
      label: 'Print-to-stockist headroom',
      result: clock.headroomDays,
      target: 0,
      variance: clock.headroomDays,
      ok: clock.headroomDays >= 0,
      note:
        clock.headroomDays >= 0
          ? `${clock.headroomDays} day(s) of slack before the first wave must be in store.`
          : `The first wave is due in store ${Math.abs(clock.headroomDays)} day(s) before print can deliver it. Move the print date or the wave.`,
    })
  }

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
