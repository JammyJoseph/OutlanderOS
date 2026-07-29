/**
 * Seeds Issue 02's rollout plan from Quinn's fulfilment spreadsheet.
 *
 *   DATABASE_URL=... npx tsx prisma/seed-issue02-rollout.ts [--apply]
 *
 * Dry run by default. Idempotent: skips if the issue already has a plan, so a
 * re-run can't duplicate 53 stockists.
 *
 * Only INPUT values are seeded. Cover splits per store, hub totals and every
 * reconciliation figure are derived at read time by lib/rollout.ts — seeding
 * them would create a second copy that could drift.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { coverUnits, reconcile, hubTotals, type PlanInput } from '../src/lib/rollout'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const APPLY = process.argv.includes('--apply')
const ISSUE_NUMBER = 2

const COVERS = [
  { name: 'Cover 1', sku: 'OUT02-C1', sharePct: 35, isBalancer: false, notes: 'Separate SKU and factory-printed barcode. No substitutions.' },
  { name: 'Cover 2', sku: 'OUT02-C2', sharePct: 35, isBalancer: false, notes: 'Separate SKU and factory-printed barcode. No substitutions.' },
  { name: 'Cover 3', sku: 'OUT02-C3', sharePct: 20, isBalancer: false, notes: 'Separate SKU and factory-printed barcode. No substitutions.' },
  { name: 'Cover 3B', sku: 'OUT02-C3B', sharePct: 10, isBalancer: true, notes: 'The balancer — absorbs rounding so the run always ties.' },
]

const PROFILES = [
  { name: 'Standard', splits: { 'Cover 1': 35, 'Cover 2': 35, 'Cover 3': 20, 'Cover 3B': 10 }, isDefault: true, notes: 'The house mix.' },
  { name: 'Talent', splits: { 'Cover 1': 40, 'Cover 2': 25, 'Cover 3': 25, 'Cover 3B': 10 }, isDefault: false, notes: 'Galleries, flagships, art bookshops.' },
  { name: 'Collector', splits: { 'Cover 1': 30, 'Cover 2': 45, 'Cover 3': 15, 'Cover 3B': 10 }, isDefault: false, notes: 'Asia-Pacific and streetwear accounts.' },
]

const HUBS = [
  { name: 'UK', location: 'United Kingdom', isDirect: false, serves: 'UK B2C and gifting, London event stock, Asia-Pacific / Middle East and rest-of-world orders, archive, replacements and the uncommitted stockist reserve.' },
  { name: 'EU (NL)', location: 'Netherlands', isDirect: false, serves: 'EU B2C and gifting, Paris event stock and all EU stockists — shipped inside the EU, so no UK-to-EU import friction.' },
  { name: 'US (SLC)', location: 'Salt Lake City, Utah', isDirect: false, serves: 'Lead ecommerce hub. US B2C and gifting, New York and Los Angeles events, all US stockists, plus Canada and South America.' },
  { name: 'Direct', location: 'Direct from printer', isDirect: true, serves: 'Asia-Pacific stockist cartons shipped direct — cheaper than double-handling through a hub.' },
]

const CHANNELS = [
  { name: 'Phase 1 — first online release', units: 2000, kind: 'B2C', hub: null, purpose: 'Launch-day B2C stock, positioned regionally before 1 November.' },
  { name: 'Phase 2 — optional online release', units: 2000, kind: 'B2C', hub: null, purpose: 'Held flexibly; released and repositioned once Phase 1 demand is clear.' },
  // Hub set so the UNALLOCATED remainder (3,750 − what the 53 stockists take)
  // has somewhere physical to sit. Without it the warehouse model is 750 short.
  { name: 'Global stockists (B2B)', units: 3750, kind: 'B2B', hub: 'UK', purpose: '3,000 primary selects confirmed; 750 held for secondary selects / replenishment.' },
  { name: 'Seeding, community, VIP & promotional', units: 1000, kind: 'SEEDING', hub: null, purpose: 'Talent, press, contributors, partners and community gifting.' },
  { name: 'Launch events', units: 750, kind: 'EVENTS', hub: null, purpose: 'Sent directly to event cities where practical.' },
  { name: 'Archive, replacement & buffer', units: 500, kind: 'BUFFER', hub: 'UK', purpose: 'Replacements, archive, late press requests and contingency.' },
]

const TERRITORIES = [
  { name: 'US', hub: 'US (SLC)', phase1: 850, phase2: 850, seedingVip: 300 },
  { name: 'UK', hub: 'UK', phase1: 550, phase2: 550, seedingVip: 350 },
  { name: 'EU', hub: 'EU (NL)', phase1: 400, phase2: 400, seedingVip: 200 },
  { name: 'Canada', hub: 'US (SLC)', phase1: 80, phase2: 80, seedingVip: 50 },
  { name: 'South America', hub: 'US (SLC)', phase1: 50, phase2: 50, seedingVip: 35 },
  { name: 'Asia-Pacific / Middle East', hub: 'UK', phase1: 50, phase2: 50, seedingVip: 50 },
  { name: 'Rest of world', hub: 'UK', phase1: 20, phase2: 20, seedingVip: 15 },
]

const EVENTS = [
  { city: 'London', hub: 'UK', units: 250, notes: 'Launch event stock held at UK hub.' },
  { city: 'New York', hub: 'US (SLC)', units: 250, notes: 'Shipped domestically from Salt Lake City.' },
  { city: 'Paris', hub: 'EU (NL)', units: 150, notes: 'Shipped from the Netherlands — no UK/EU import friction.' },
  { city: 'Los Angeles', hub: 'US (SLC)', units: 100, notes: 'Potential second US event; domestic ex-SLC.' },
]

const LANES = [
  { name: 'UK to United States — last year’s drop', ratePerOrder: 33.0, currency: 'GBP', volume: 0, isBaseline: true, quoteStatus: 'What Issue 01 actually cost per US order. The number to beat.' },
  { name: 'Salt Lake City to New York', ratePerOrder: 11.0, currency: 'USD', volume: 0, isBaseline: false, quoteStatus: 'Domestic US shipment. No duty, no customs.' },
  { name: 'Salt Lake City to Los Angeles', ratePerOrder: 9.5, currency: 'USD', volume: 0, isBaseline: false, quoteStatus: 'Domestic US shipment. No duty, no customs.' },
  { name: 'US domestic, ex Salt Lake City', ratePerOrder: 10.4, currency: 'USD', volume: 2000, isBaseline: false, quoteStatus: 'Confirmed by the blended rate.' },
  { name: 'UK domestic, ex UK hub', ratePerOrder: null, currency: 'GBP', volume: 1450, isBaseline: false, quoteStatus: 'Fidelity / Spatial pricing due 7 August.' },
  { name: 'EU domestic, ex Netherlands', ratePerOrder: null, currency: 'EUR', volume: 1000, isBaseline: false, quoteStatus: 'Fidelity / Spatial pricing due 7 August.' },
  { name: 'Canada, ex Salt Lake City', ratePerOrder: null, currency: 'USD', volume: 210, isBaseline: false, quoteStatus: 'DDP required.' },
  { name: 'South America, ex Salt Lake City', ratePerOrder: null, currency: 'USD', volume: 135, isBaseline: false, quoteStatus: 'DDP required.' },
  { name: 'Asia-Pacific / Middle East, ex UK', ratePerOrder: null, currency: 'GBP', volume: 150, isBaseline: false, quoteStatus: 'DDP required.' },
  { name: 'Rest of world, ex UK', ratePerOrder: null, currency: 'GBP', volume: 55, isBaseline: false, quoteStatus: 'DDP required.' },
]

const MILESTONES = [
  { seq: 1, window: 'By 7 August', date: '2026-08-07', action: 'Appoint preferred fulfilment partner; confirm UK, US and EU warehouse model; agree regional approach, core fees and tax/customs responsibilities.', owner: 'Outlander / Ops', criticalPath: true },
  { seq: 2, window: 'By 14 August', date: '2026-08-14', action: 'Fulfilment partners submit standard book-wrap and corner-protector samples, plus branded VIP box options, branding methods, MOQs, lead times and costs.', owner: 'Fidelity / Spatial', criticalPath: true },
  { seq: 3, window: 'By 21 August', date: '2026-08-21', action: 'Outlander selects and approves final standard packaging sample and VIP packaging option; place packaging orders.', owner: 'Outlander', criticalPath: true },
  { seq: 4, window: 'By 28 August', date: '2026-08-28', action: 'Finalise four SKU codes, separate factory-printed barcodes, carton labels, carton quantities and printer destination instructions.', owner: 'Outlander / Printer', criticalPath: false },
  { seq: 5, window: 'By 4 September', date: '2026-09-04', action: 'Lock first-wave regional allocations; confirm stock separated by cover at source; confirm warehouse, event, stockist and reserve quantities.', owner: 'Outlander', criticalPath: true },
  { seq: 6, window: 'By 11 September', date: '2026-09-11', action: 'Complete ecommerce integration: cover SKUs, single and two-item bundle rules, regional routing, tracking, shipping zones, tax settings, manual gifting uploads.', owner: 'Ecommerce', criticalPath: false },
  { seq: 7, window: 'By 18 September', date: '2026-09-18', action: 'Finalise event allocations, primary store addresses and first VIP list; agree returns, replacement, claims and launch-week service levels.', owner: 'Outlander / Ops', criticalPath: false },
  { seq: 8, window: 'By 25 September', date: '2026-09-25', action: 'Book UK, US and EU freight; complete customs documents; confirm importer details and warehouse booking slots; all packaging inbound to each warehouse.', owner: 'Ops / Freight', criticalPath: true },
  { seq: 9, window: 'By 2 October', date: '2026-10-02', action: 'Complete print run and final finishing; check quantities; label pallets by destination, SKU, carton count and quantity; approve all freight paperwork.', owner: 'Printer', criticalPath: false },
  { seq: 10, window: 'W/C 5 October', date: '2026-10-05', action: 'Collect stock from printer; dispatch UK, US and EU allocations; dispatch event and direct stockist inventory; monitor inbound freight daily.', owner: 'Ops / Freight', criticalPath: true },
  { seq: 11, window: 'Friday 16 October', date: '2026-10-16', action: 'FINAL DEADLINE — all launch stock and packaging physically received at regional warehouses.', owner: 'All', criticalPath: true },
  { seq: 12, window: '16–20 October', date: '2026-10-16', action: 'Goods-in: scan and reconcile all four SKUs, photograph damage, report discrepancies, move stock into active pick locations.', owner: 'Warehouses', criticalPath: false },
  { seq: 13, window: '21–23 October', date: '2026-10-21', action: 'Live test orders from each regional warehouse; verify cover accuracy, packaging protection, tracking, transit time and prepaid-duty handling.', owner: 'Ops', criticalPath: true },
  { seq: 14, window: '24–27 October', date: '2026-10-24', action: 'Pre-kit VIP and gifting packs; validate address lists; confirm launch staffing, carrier collections, escalation contacts and replacement stock.', owner: 'Ops / Warehouses', criticalPath: false },
  { seq: 15, window: '28–30 October', date: '2026-10-28', action: 'Final readiness check: inventory, shipping rates, duties, tracking, routing, packaging and customer-support processes.', owner: 'All', criticalPath: false },
  { seq: 16, window: '31 October', date: '2026-10-31', action: 'Final go / no-go review.', owner: 'Outlander', criticalPath: true },
  { seq: 17, window: '1 November', date: '2026-11-01', action: 'LAUNCH — Phase 1 B2C release; route orders regionally and begin daily launch reporting.', owner: 'All', criticalPath: true },
  { seq: 18, window: '2–8 November', date: '2026-11-02', action: 'Monitor sell-through by cover and territory; dispatch gifting; resolve exceptions and replacements.', owner: 'Ops', criticalPath: false },
  { seq: 19, window: 'From 9 November', date: '2026-11-09', action: 'Decide timing and regional allocation of the optional Phase 2 stock based on actual demand.', owner: 'Outlander', criticalPath: true },
]

// [name, city, market, hub, profile, units]
const STOCKISTS: [string, string, string, string, string, number][] = [
  ['Selfridges', 'London', 'UK', 'UK', 'Talent', 80],
  ['Good News', 'London', 'UK', 'UK', 'Standard', 80],
  ['Shreeji News', 'London', 'UK', 'UK', 'Standard', 80],
  ['Dover St Market (via Idea Books)', 'London', 'UK', 'UK', 'Talent', 80],
  ['News & Coffee, Coal Drops Yard', 'London', 'UK', 'UK', 'Standard', 50],
  ['MagCulture', 'London', 'UK', 'UK', 'Standard', 80],
  ['Serpentine Gallery', 'London', 'UK', 'UK', 'Talent', 50],
  ['UAL: Central St Martins (Archway)', 'London', 'UK', 'UK', 'Standard', 20],
  ['Selfridges', 'Manchester', 'UK', 'UK', 'Talent', 50],
  ['Soho News International', 'New York', 'US', 'US (SLC)', 'Talent', 250],
  ['Casa Magazines', 'New York', 'US', 'US (SLC)', 'Standard', 80],
  ['Mulberry Iconic', 'New York', 'US', 'US (SLC)', 'Standard', 80],
  ['Iconic Magazines', 'New York', 'US', 'US (SLC)', 'Standard', 80],
  ['Dashwood Books', 'New York', 'US', 'US (SLC)', 'Talent', 50],
  ['Printed Matter', 'Chelsea, New York', 'US', 'US (SLC)', 'Talent', 50],
  ['McNally Jackson', 'Soho, New York', 'US', 'US (SLC)', 'Standard', 50],
  ['Kid Super Workshop', 'New York', 'US', 'US (SLC)', 'Collector', 50],
  ['Atlanta allocation', 'Atlanta', 'US', 'US (SLC)', 'Standard', 50],
  ['Miami allocation', 'Miami', 'US', 'US (SLC)', 'Standard', 50],
  ['Chicago allocation', 'Chicago', 'US', 'US (SLC)', 'Standard', 50],
  ['San Francisco allocation', 'San Francisco', 'US', 'US (SLC)', 'Standard', 50],
  ['Chess Club', 'Portland', 'US', 'US (SLC)', 'Standard', 50],
  ['Brazos Bookstore', 'Houston', 'US', 'US (SLC)', 'Talent', 50],
  ['Beverly Hills Newsstand', 'Beverly Hills', 'US', 'US (SLC)', 'Standard', 50],
  ['Dover Street Market LA', 'Los Angeles', 'US', 'US (SLC)', 'Talent', 50],
  ['Book Soup', 'West Hollywood', 'US', 'US (SLC)', 'Standard', 50],
  ['Pablo T-Shirt Factory', 'Paris', 'France', 'EU (NL)', 'Collector', 50],
  ['Shakespeare and Company', 'Paris', 'France', 'EU (NL)', 'Talent', 80],
  ['Reading Room', 'Milan', 'Italy', 'EU (NL)', 'Standard', 80],
  ['AirMail', 'Milan', 'Italy', 'EU (NL)', 'Standard', 50],
  ['Gucci Garden', 'Florence', 'Italy', 'EU (NL)', 'Talent', 50],
  ['Edicola Erno', 'Rome', 'Italy', 'EU (NL)', 'Standard', 50],
  ['News and Coffee', 'Barcelona', 'Spain', 'EU (NL)', 'Standard', 50],
  ['Odd Kiosk', 'Barcelona', 'Spain', 'EU (NL)', 'Standard', 50],
  ['SGEL', 'Madrid', 'Spain', 'EU (NL)', 'Standard', 50],
  ['do you read me?!', 'Berlin', 'Germany', 'EU (NL)', 'Standard', 100],
  ['Gudberg Nerger', 'Hamburg', 'Germany', 'EU (NL)', 'Standard', 80],
  ['Issues', 'Toronto', 'Canada', 'US (SLC)', 'Standard', 60],
  ['Presse Internationale', 'Toronto', 'Canada', 'US (SLC)', 'Standard', 40],
  ['IMS Belgium', 'Antwerp', 'Belgium', 'EU (NL)', 'Standard', 50],
  ['NIPPAN IPS Co. Ltd.', 'Tokyo, Japan', 'Rest of world', 'Direct', 'Collector', 50],
  ['Stone and Wave Co. Ltd.', 'Seoul, South Korea', 'Rest of world', 'Direct', 'Collector', 50],
  ['World Magazine Co. Ltd.', 'Seoul, South Korea', 'Rest of world', 'Direct', 'Collector', 50],
  ['Basheer Graphic Books', 'Singapore', 'Rest of world', 'Direct', 'Collector', 30],
  ['Reading Books', 'Carlton, Australia', 'Rest of world', 'Direct', 'Collector', 30],
  ['Athenaeum', 'Amsterdam', 'Rest of world', 'EU (NL)', 'Standard', 30],
  ['Papercut', 'Stockholm', 'Rest of world', 'EU (NL)', 'Standard', 30],
  ['Hyper Hypo E.E', 'Athens', 'Rest of world', 'EU (NL)', 'Standard', 30],
  ['The Monocle Kiosk', 'Zurich', 'Rest of world', 'EU (NL)', 'Talent', 30],
  ['The Library Project', 'Dublin', 'Rest of world', 'EU (NL)', 'Standard', 30],
  ['Under the Cover', 'Lisbon', 'Rest of world', 'EU (NL)', 'Standard', 30],
  ['Candy Kiosken', 'Frederiksberg', 'Rest of world', 'EU (NL)', 'Standard', 30],
  ['Brot Books Deli s.r.o.', 'Prague', 'Rest of world', 'EU (NL)', 'Standard', 30],
]

const ASSUMPTIONS = `• Exchange rate of 1.30 GBP/USD is an assumption — update it and the saving recalculates.
• The US saving assumes one magazine per order. Two-item bundles reduce the per-unit saving but improve it per order.
• UK, EU, Canada, South America, APAC and rest-of-world rates are blank until Fidelity Fulfilment and Spatial Global quote (due 7 and 14 August).
• Phase 2 (2,000 units) is held flexibly and should not be physically repositioned until Phase 1 sell-through is clear.
• 750 of the 3,750 stockist units are uncommitted. The plan's "cover source locations" reserve should be funded from here.
• Asia-Pacific stockists ship direct from the printer. If the printer cannot split-ship, those 210 units move to the UK hub and the UK total rises accordingly.
• All duties must be prepaid. Any country that cannot be served without a recipient charge must be flagged before orders are accepted.`

async function main() {
  const issue = await prisma.magazinePlan.findUnique({ where: { issueNumber: ISSUE_NUMBER } })
  if (!issue) throw new Error(`No MagazinePlan with issueNumber ${ISSUE_NUMBER}`)
  console.log(`Issue ${issue.issueNumber} — ${issue.issueName} (${issue.id})`)
  console.log(APPLY ? 'MODE: APPLY\n' : 'MODE: DRY RUN (pass --apply to write)\n')

  const existing = await prisma.rolloutPlan.findUnique({ where: { magazinePlanId: issue.id } })
  if (existing) {
    console.log('This issue already has a rollout plan — nothing to do.')
    return
  }

  console.log(`Would create: ${COVERS.length} covers, ${PROFILES.length} profiles, ${HUBS.length} hubs,`)
  console.log(`  ${CHANNELS.length} channels, ${TERRITORIES.length} territories, ${STOCKISTS.length} stockists,`)
  console.log(`  ${EVENTS.length} events, ${LANES.length} lanes, ${MILESTONES.length} milestones`)

  if (!APPLY) {
    console.log('\nDry run — nothing written.')
    return
  }

  const plan = await prisma.rolloutPlan.create({
    data: {
      magazinePlanId: issue.id,
      totalPrintRun: 10000,
      launchDate: new Date('2026-11-01'),
      warehouseDeadline: new Date('2026-10-16'),
      gbpToUsd: 1.3,
      eastCoastShare: 60,
      assumptions: ASSUMPTIONS,
    },
  })

  await prisma.rolloutCover.createMany({
    data: COVERS.map((c, i) => ({ ...c, planId: plan.id, sortOrder: i })),
  })
  await prisma.coverProfile.createMany({
    data: PROFILES.map((p, i) => ({ ...p, planId: plan.id, sortOrder: i })),
  })
  await prisma.fulfilmentHub.createMany({
    data: HUBS.map((h, i) => ({ ...h, planId: plan.id, sortOrder: i })),
  })

  const hubs = await prisma.fulfilmentHub.findMany({ where: { planId: plan.id } })
  const hubId = (name: string | null) => (name ? hubs.find((h) => h.name === name)?.id ?? null : null)
  const profiles = await prisma.coverProfile.findMany({ where: { planId: plan.id } })
  const profileId = (name: string) => profiles.find((p) => p.name === name)?.id ?? null

  await prisma.rolloutChannel.createMany({
    data: CHANNELS.map((c, i) => ({
      planId: plan.id,
      name: c.name,
      units: c.units,
      kind: c.kind,
      purpose: c.purpose,
      hubId: hubId(c.hub),
      sortOrder: i,
    })),
  })
  await prisma.rolloutTerritory.createMany({
    data: TERRITORIES.map((t, i) => ({
      planId: plan.id,
      name: t.name,
      hubId: hubId(t.hub),
      phase1: t.phase1,
      phase2: t.phase2,
      seedingVip: t.seedingVip,
      sortOrder: i,
    })),
  })
  await prisma.rolloutEvent.createMany({
    data: EVENTS.map((e, i) => ({
      planId: plan.id,
      city: e.city,
      hubId: hubId(e.hub),
      units: e.units,
      notes: e.notes,
      sortOrder: i,
    })),
  })
  await prisma.shippingLane.createMany({
    data: LANES.map((l, i) => ({ ...l, planId: plan.id, sortOrder: i })),
  })
  await prisma.rolloutMilestone.createMany({
    data: MILESTONES.map((m) => ({
      planId: plan.id,
      seq: m.seq,
      window: m.window,
      date: new Date(m.date),
      action: m.action,
      owner: m.owner,
      criticalPath: m.criticalPath,
      status: 'NOT_STARTED',
    })),
  })
  await prisma.stockist.createMany({
    data: STOCKISTS.map(([name, city, market, hub, profile, units], i) => ({
      planId: plan.id,
      name,
      city,
      market,
      hubId: hubId(hub),
      profileId: profileId(profile),
      units,
      sortOrder: i,
    })),
  })

  // ── Verify against the derivations, not against what we just typed ──
  const full = await prisma.rolloutPlan.findUnique({
    where: { id: plan.id },
    include: {
      covers: { orderBy: { sortOrder: 'asc' } },
      profiles: true,
      hubs: true,
      channels: true,
      territories: true,
      stockists: true,
      events: true,
      lanes: true,
    },
  })
  const input = {
    ...full!,
    profiles: full!.profiles.map((p) => ({ ...p, splits: p.splits as Record<string, number> })),
  } as unknown as PlanInput

  console.log('\nCover master:')
  for (const c of coverUnits(input)) {
    console.log(`  ${c.cover.name.padEnd(10)} ${c.cover.sku.padEnd(12)} ${String(c.units).padStart(6)}`)
  }

  console.log('\nRegional warehouse model:')
  for (const h of hubTotals(input)) {
    console.log(
      `  ${h.hub.name.padEnd(10)} B2C ${String(h.b2cAndGifting).padStart(5)}  events ${String(h.events).padStart(4)}  stockists ${String(h.stockists).padStart(5)}  reserve ${String(h.reserveAndBuffer).padStart(5)}  = ${String(h.total).padStart(6)}  (${h.sharePct.toFixed(1)}%)`
    )
  }

  console.log('\nReconciliation:')
  let bad = 0
  for (const c of reconcile(input)) {
    const mark = c.ok ? '✓' : '✗'
    if (!c.ok) bad++
    console.log(
      `  ${mark} ${c.label.padEnd(44)} ${String(c.result).padStart(6)} vs ${String(c.target).padStart(6)}  variance ${c.variance}`
    )
  }
  if (bad > 0) throw new Error(`${bad} reconciliation check(s) failed`)
  console.log('\n✓ Every check reconciles.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
