// ═══════════════════════════════════════════════════════════════════════════
// Issue 02 rollout — v2 seed.
//
// REPLACES the existing plan rather than migrating it. The v1 model had one
// launch date, one B2C release and a flat stockist list; v2 restructures around
// three staggered drops, two stockist waves and a full economics model, so the
// territory splits and cover profiles have both changed shape. Mapping the old
// buckets onto the new ones would produce numbers that tie but mean nothing.
//
// Deleting the RolloutPlan cascades to every child row. Anything edited on the
// platform since the v1 seed is lost — that was the explicit call.
//
//   DATABASE_URL=... npx tsx prisma/seed-issue02-rollout-v2.ts
// ═══════════════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  reconcile,
  hubTotals,
  dropSchedule,
  waveSchedule,
  printClock,
  territoryDropHolds,
  basketEconomics,
  blendedUsLaneUsd,
  rateCardFor,
  scenarioCosts,
  yearOnYear,
  stockistFreight,
  placeholderAudit,
  type PlanInput,
} from '../src/lib/rollout'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const ISSUE_NUMBER = 2
const RUN = 10_000

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)

// ── Drops: release dates, not delivery dates ────────────────────────────────
// Shares are 33.75 / 33.75 / 32.5. The sheet displays 33.8% rounded; using the
// displayed figure would release 1,352 units in Drop 1 instead of 1,350.
const DROPS = [
  { name: 'Drop 1', goLiveAt: d('2026-11-01'), sharePct: 33.75, isBalancer: false, notes: 'Opens the campaign and the Full Set bundle. Only the 12 promo stores have stock.' },
  { name: 'Drop 2', goLiveAt: d('2026-11-07'), sharePct: 33.75, isBalancer: false, notes: 'A second paid moment with no new logistics — promo stock has been in store since 27 October.' },
  { name: 'Drop 3', goLiveAt: d('2026-11-14'), sharePct: 32.5, isBalancer: true, notes: 'Character covers plus the limited holographic. The wider stockist list lands straight after.' },
]

const COVERS = [
  { name: 'Cover 1', subject: 'Human talent', sku: 'OUT02-C1', sharePct: 35, isBalancer: false, drop: 'Drop 1' },
  { name: 'Cover 2', subject: 'Human talent', sku: 'OUT02-C2', sharePct: 35, isBalancer: false, drop: 'Drop 2' },
  { name: 'Cover 3', subject: 'Pokémon character', sku: 'OUT02-C3', sharePct: 20, isBalancer: false, drop: 'Drop 3' },
  { name: 'Cover 3B', subject: 'Pokémon character — holographic, limited', sku: 'OUT02-C3B', sharePct: 10, isBalancer: true, drop: 'Drop 3', notes: 'Shares Drop 3 with Cover 3. The balancer — absorbs rounding so the run always ties.' },
]

// Verified against every row of the store table: these three profiles reproduce
// the sheet's per-store cover columns exactly, with Cover 3B taking the
// remainder on each row.
const PROFILES = [
  { name: 'Even', splits: { 'Cover 1': 37, 'Cover 2': 37, 'Cover 3': 19, 'Cover 3B': 7 }, isDefault: true, notes: 'Roughly the house split, tracking the print run.' },
  { name: 'Talent-led', splits: { 'Cover 1': 42, 'Cover 2': 40, 'Cover 3': 13, 'Cover 3B': 5 }, isDefault: false, notes: 'Fashion, design and gallery accounts where the talent covers sell first.' },
  { name: 'Character-led', splits: { 'Cover 1': 27, 'Cover 2': 27, 'Cover 3': 36, 'Cover 3B': 10 }, isDefault: false, notes: 'Character and collector accounts, mainly Asia-Pacific and streetwear.' },
]

const WAVES = [
  { name: 'Wave 1 — Promo', tier: 'PRIMARY', isEmbargoed: true, notes: 'One delivery each, full allocation, all four covers, before Drop 1. The only stockist stock in the world until 1 November.' },
  { name: 'Wave 2 — Wider', tier: 'WIDER', isEmbargoed: false, notes: 'Lands after Drop 3, so there is no embargo to police and nothing to leak.' },
]

const HUBS = [
  { name: 'UK', location: 'United Kingdom', isDirect: false, serves: 'UK B2C and gifting, London event stock, Asia-Pacific / Middle East and rest-of-world orders, archive, replacements and the uncommitted stockist reserve. No stockist deliveries — TLC ships those direct.' },
  { name: 'EU (NL)', location: 'Netherlands', isDirect: false, serves: 'EU B2C and gifting and Paris event stock — shipped inside the EU, so no UK-to-EU import friction. No stockist deliveries.' },
  { name: 'US (SLC)', location: 'Salt Lake City, Utah', isDirect: false, serves: 'Lead ecommerce hub. US B2C and gifting, New York and Los Angeles events, plus Canada and South America. No stockist deliveries.' },
  // TLC stocks every brick-and-mortar account worldwide straight off the print
  // floor. Stockist cartons never touch a regional warehouse, so they must not
  // appear in the regional warehouse count — this hub is where they sit instead.
  { name: 'Direct (TLC)', location: 'Direct from the printer', isDirect: true, serves: 'Every stockist carton globally, picked and packed by TLC and shipped straight from the print floor. Holds no stock for B2C, gifting or events.' },
]

const RATE_CARDS = [
  { hub: 'UK', currency: 'GBP', orderFee: 1.10, itemPick: 0.45, isPlaceholder: false, source: 'Quoted rate card. £1.55 for one magazine, £2.00 for two — the second magazine costs 45p.' },
  { hub: 'US (SLC)', currency: 'USD', orderFee: 1.50, itemPick: 0.66, isPlaceholder: false, source: 'Quoted rate card. $2.16 for one magazine, $2.82 for two — the second magazine costs 66c.' },
  { hub: 'EU (NL)', currency: 'EUR', orderFee: 1.25, itemPick: 0.50, isPlaceholder: true, source: 'PLACEHOLDER — not yet quoted. Overwrite when the Dutch rate card lands.' },
]

const CHANNELS = [
  { name: 'Online B2C (all three drops)', units: 4000, kind: 'B2C', hub: null, purpose: 'One pool. All 4,000 units ship to the three warehouses before launch; drops are released by date, not by restock.' },
  { name: 'Global stockists (B2B)', units: 3750, kind: 'B2B', hub: 'UK', purpose: '3,000 primary selects across 53 trading outlets, one delivery each, all shipped direct by TLC. The 750-unit reserve is the only part that warehouses — replenishment from 16 November cannot come off a print floor.' },
  { name: 'Seeding, community, VIP & promotional', units: 1000, kind: 'SEEDING', hub: null, purpose: 'Talent, press, contributors, partners and community gifting.' },
  { name: 'Launch events', units: 750, kind: 'EVENTS', hub: null, purpose: 'Sent directly to event cities where practical.' },
  { name: 'Archive, replacement & buffer', units: 500, kind: 'BUFFER', hub: 'UK', purpose: 'Replacements, archive, late press requests and contingency.' },
]

const TERRITORIES = [
  { name: 'US', hub: 'US (SLC)', b2cUnits: 1700, seedingVip: 300 },
  { name: 'UK', hub: 'UK', b2cUnits: 1100, seedingVip: 350 },
  { name: 'EU', hub: 'EU (NL)', b2cUnits: 800, seedingVip: 200 },
  { name: 'Canada', hub: 'US (SLC)', b2cUnits: 160, seedingVip: 50 },
  { name: 'South America', hub: 'US (SLC)', b2cUnits: 100, seedingVip: 35 },
  { name: 'Asia-Pacific / Middle East', hub: 'UK', b2cUnits: 100, seedingVip: 50 },
  { name: 'Rest of world', hub: 'UK', b2cUnits: 40, seedingVip: 15 },
]

const EVENTS = [
  { city: 'London', hub: 'UK', units: 250, notes: 'Launch event stock held at UK hub.' },
  { city: 'New York', hub: 'US (SLC)', units: 250, notes: 'Shipped domestically from Salt Lake City.' },
  { city: 'Paris', hub: 'EU (NL)', units: 150, notes: 'Shipped from the Netherlands — no UK/EU import friction.' },
  { city: 'Los Angeles', hub: 'US (SLC)', units: 100, notes: 'Potential second US event; domestic ex-SLC.' },
]

const LANES = [
  { name: 'Salt Lake City → New York', ratePerOrder: 11.00, currency: 'USD', volume: 0, quoteStatus: 'QUOTED', isPlaceholder: false, isBaseline: false },
  { name: 'Salt Lake City → Los Angeles', ratePerOrder: 9.50, currency: 'USD', volume: 0, quoteStatus: 'QUOTED', isPlaceholder: false, isBaseline: false },
  { name: 'UK hub → UK domestic', ratePerOrder: 3.50, currency: 'GBP', volume: 0, quoteStatus: 'ASSUMED', isPlaceholder: true, isBaseline: false },
  { name: 'EU hub → EU domestic', ratePerOrder: 5.00, currency: 'EUR', volume: 0, quoteStatus: 'ASSUMED', isPlaceholder: true, isBaseline: false },
  { name: 'UK hub → rest of world', ratePerOrder: 12.00, currency: 'GBP', volume: 0, quoteStatus: 'ASSUMED', isPlaceholder: true, isBaseline: false },
  { name: 'LAST YEAR: UK → US, per order', ratePerOrder: 33.00, currency: 'GBP', volume: 0, quoteStatus: 'ACTUAL', isPlaceholder: false, isBaseline: true },
]

// tier: PRIMARY = one of the 12 promo accounts. WIDER = the wider list.
// reserved: a slot with no account named yet — 0 units, and NOT a shipment.
type S = { n: string; city: string; market: string; hub: string; profile: string; tier: string; units: number; reserved?: boolean }
const STOCKISTS: S[] = [
  { n: 'Selfridges', city: 'London', market: 'UK', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 80 },
  { n: 'Good News', city: 'London', market: 'UK', hub: 'Direct (TLC)', profile: 'Even', tier: 'PRIMARY', units: 80 },
  { n: 'Shreeji News', city: 'London', market: 'UK', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 80 },
  { n: 'Dover St Market (via Idea Books)', city: 'London', market: 'UK', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 80 },
  { n: 'News & Coffee, Coal Drops Yard', city: 'London', market: 'UK', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 50 },
  { n: 'MagCulture', city: 'London', market: 'UK', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'PRIMARY', units: 80 },
  { n: 'Serpentine Gallery', city: 'London', market: 'UK', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 50 },
  { n: 'UAL: Central St Martins (Archway)', city: 'London', market: 'UK', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 20 },
  { n: 'Selfridges', city: 'Manchester', market: 'UK', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 50 },
  { n: 'Soho News International', city: 'New York', market: 'US', hub: 'Direct (TLC)', profile: 'Even', tier: 'PRIMARY', units: 250 },
  { n: 'Casa Magazines', city: 'New York', market: 'US', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 80 },
  { n: 'Mulberry Iconic', city: 'New York', market: 'US', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 80 },
  { n: 'Iconic Magazines', city: 'New York', market: 'US', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 80 },
  { n: 'Dashwood Books', city: 'New York', market: 'US', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 50 },
  { n: 'Printed Matter', city: 'Chelsea, New York', market: 'US', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 50 },
  { n: 'McNally Jackson', city: 'Soho, New York', market: 'US', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 50 },
  { n: 'Kid Super Workshop', city: 'New York', market: 'US', hub: 'Direct (TLC)', profile: 'Character-led', tier: 'WIDER', units: 50 },
  { n: 'Atlanta allocation', city: 'Atlanta', market: 'US', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 50 },
  { n: 'Miami allocation', city: 'Miami', market: 'US', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 50 },
  { n: 'Chicago allocation', city: 'Chicago', market: 'US', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 50 },
  { n: 'Reserved — home city of Cover 1', city: 'TBC', market: 'US', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 0, reserved: true },
  { n: 'Reserved — home city of Cover 2', city: 'TBC', market: 'US', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 0, reserved: true },
  { n: 'San Francisco allocation', city: 'San Francisco', market: 'US', hub: 'Direct (TLC)', profile: 'Even', tier: 'PRIMARY', units: 50 },
  { n: 'Chess Club', city: 'Portland', market: 'US', hub: 'Direct (TLC)', profile: 'Even', tier: 'PRIMARY', units: 50 },
  { n: 'Brazos Bookstore', city: 'Houston', market: 'US', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'PRIMARY', units: 50 },
  { n: 'Beverly Hills Newsstand', city: 'Beverly Hills', market: 'US', hub: 'Direct (TLC)', profile: 'Even', tier: 'PRIMARY', units: 50 },
  { n: 'Dover Street Market LA', city: 'Los Angeles', market: 'US', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 50 },
  { n: 'Book Soup', city: 'West Hollywood', market: 'US', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 50 },
  { n: 'Pablo T-Shirt Factory', city: 'Paris', market: 'France', hub: 'Direct (TLC)', profile: 'Character-led', tier: 'WIDER', units: 50 },
  { n: 'Shakespeare and Company', city: 'Paris', market: 'France', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 80 },
  { n: 'Reading Room', city: 'Milan', market: 'Italy', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 80 },
  { n: 'AirMail', city: 'Milan', market: 'Italy', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 50 },
  { n: 'Gucci Garden', city: 'Florence', market: 'Italy', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 50 },
  { n: 'Edicola Erno', city: 'Rome', market: 'Italy', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 50 },
  { n: 'News and Coffee', city: 'Barcelona', market: 'Spain', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 50 },
  { n: 'Odd Kiosk', city: 'Barcelona', market: 'Spain', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 50 },
  { n: 'SGEL', city: 'Madrid', market: 'Spain', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 50 },
  { n: 'do you read me?!', city: 'Berlin', market: 'Germany', hub: 'Direct (TLC)', profile: 'Even', tier: 'PRIMARY', units: 100 },
  { n: 'Gudberg Nerger', city: 'Hamburg', market: 'Germany', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 80 },
  { n: 'Issues', city: 'Toronto', market: 'Canada', hub: 'Direct (TLC)', profile: 'Even', tier: 'PRIMARY', units: 60 },
  { n: 'Presse Internationale', city: 'Toronto', market: 'Canada', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 40 },
  { n: 'IMS Belgium', city: 'Antwerp', market: 'Belgium', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 50 },
  { n: 'NIPPAN IPS Co. Ltd.', city: 'Tokyo, Japan', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Character-led', tier: 'PRIMARY', units: 50 },
  { n: 'Stone and Wave Co. Ltd.', city: 'Seoul, South Korea', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Character-led', tier: 'PRIMARY', units: 50 },
  { n: 'World Magazine Co. Ltd.', city: 'Seoul, South Korea', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Character-led', tier: 'WIDER', units: 50 },
  { n: 'Basheer Graphic Books', city: 'Singapore', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Character-led', tier: 'WIDER', units: 30 },
  { n: 'Reading Books', city: 'Carlton, Australia', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Character-led', tier: 'WIDER', units: 30 },
  { n: 'Athenaeum', city: 'Amsterdam', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Even', tier: 'PRIMARY', units: 30 },
  { n: 'Papercut', city: 'Stockholm', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Character-led', tier: 'WIDER', units: 30 },
  { n: 'Hyper Hypo E.E', city: 'Athens', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Character-led', tier: 'WIDER', units: 30 },
  { n: 'The Monocle Kiosk', city: 'Zurich', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 30 },
  { n: 'The Library Project', city: 'Dublin', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 30 },
  { n: 'Under the Cover', city: 'Lisbon', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Talent-led', tier: 'WIDER', units: 30 },
  { n: 'Candy Kiosken', city: 'Frederiksberg', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 30 },
  { n: 'Brot Books Deli s.r.o.', city: 'Prague', market: 'Rest of world', hub: 'Direct (TLC)', profile: 'Even', tier: 'WIDER', units: 30 },
]

const MILESTONES = [
  ['By 7 August', '2026-08-07', 'Appoint preferred fulfilment partner; confirm UK, US and EU warehouse model; agree regional approach, core fees and tax/customs responsibilities.', 'Outlander / Ops'],
  ['By 14 August', '2026-08-14', 'Fulfilment partners submit standard book-wrap and corner-protector samples, plus branded VIP box options and a four-magazine full-set mailer, with MOQs, lead times and costs.', 'Fidelity / Spatial'],
  ['By 21 August', '2026-08-21', 'Outlander approves the single-copy mailer, the full-set mailer and the VIP packaging option; place packaging orders.', 'Outlander'],
  ['By 28 August', '2026-08-28', 'Finalise four SKU codes, separate factory-printed barcodes, carton labels, carton quantities and printer destination instructions — stock must arrive separated by cover.', 'Outlander / Printer'],
  ['By 4 September', '2026-09-04', 'Lock the channel and cover grid: 4,000 B2C, 3,750 stockist, 1,000 seeding, 750 events, 500 buffer, each split across the four covers.', 'Outlander'],
  ['By 11 September', '2026-09-11', 'Ecommerce build: four cover SKUs, the Full Set bundle with hold-and-consolidate shipping, drop-date release rules, regional routing, tracking, shipping zones and tax settings.', 'Ecommerce'],
  ['By 18 September', '2026-09-18', 'LOCK THE PROMO LIST at 12 accounts and confirm both delivery windows with every stockist: one delivery each, full allocation, all four covers. Signed embargo agreement from every promo account.', 'Outlander / Ops'],
  ['By 25 September', '2026-09-25', 'Book regional freight for the B2C, gifting, event and reserve allocations, plus TLC’s outbound freight to all 53 stockist accounts including the Tokyo and Seoul air lanes; complete customs documents; confirm importer details and warehouse booking slots; all packaging inbound.', 'Ops / Freight'],
  ['Friday 2 October', '2026-10-02', 'PRINT COMPLETE. The three-week clock to stockists starts here — nothing can be in a store before 23 October.', 'Printer'],
  ['W/C 5 October', '2026-10-05', 'Collect the B2C, gifting, event and reserve allocations from the printer and dispatch to the UK, US and EU hubs. TLC retains the full 3,000-unit stockist allocation on the print floor for both waves; monitor inbound freight daily.', 'Ops / Freight'],
  ['Friday 16 October', '2026-10-16', 'FINAL DEADLINE — all launch stock and packaging physically received at regional warehouses, including the full 4,000-unit B2C pool.', 'All'],
  ['16–20 October', '2026-10-16', 'Goods-in: scan and reconcile all four SKUs, photograph damage, report discrepancies, move stock into active pick locations.', 'Warehouses'],
  ['19–22 October', '2026-10-19', 'TLC picks and packs the promo wave: 12 accounts, whole allocation each, all four covers in one carton set, embargo notice packed on top of every carton.', 'Printer (TLC)'],
  ['21–23 October', '2026-10-21', 'Live test orders from each regional warehouse; verify cover accuracy, four-magazine bundle packing, tracking, transit time and prepaid-duty handling.', 'Ops'],
  ['Friday 23 October', '2026-10-23', 'PROMO WAVE DISPATCHED from the print floor — 12 accounts, one shipment each, full allocation, all four covers. This is the only stockist stock in the world before Drop 1.', 'Printer (TLC)'],
  ['Monday 26 October', '2026-10-26', 'Pre-kit VIP and gifting packs; validate address lists; confirm launch staffing, carrier collections, escalation contacts and replacement stock.', 'Ops / Warehouses'],
  ['Tuesday 27 October', '2026-10-27', 'PROMO WAVE RECEIVED. Re-state the embargo in writing to all 12: nothing on shelf before 1 November, Cover 2 held to 7 November, Cover 3 and 3B held to 14 November.', 'Ops'],
  ['Saturday 31 October', '2026-10-31', 'Final go / no-go review.', 'Outlander'],
  ['Sunday 1 November', '2026-11-01', 'DROP 1 — Cover 1 live online and in the 12 promo stores. Full Set bundle opens for sale, shipping held until after Drop 3.', 'All'],
  ['Tuesday 3 November', '2026-11-03', 'Review Drop 1 sell-through by cover and territory and the Full Set attach rate; re-weight Drop 2 and Drop 3 B2C availability if needed; check promo accounts are holding the embargo.', 'Outlander / Ops'],
  ['Saturday 7 November', '2026-11-07', 'DROP 2 — Cover 2 live online and in the promo stores. No new logistics; the stock has been sitting in store since 27 October.', 'All'],
  ['Monday 9 November', '2026-11-09', 'TLC picks and packs the wider wave: 41 accounts, whole allocation each, one carton set per store. Reconcile against the promo wave and the reserve before release.', 'Printer (TLC)'],
  ['Thursday 12 November', '2026-11-12', 'WIDER WAVE DISPATCHED from the print floor — 41 accounts, one shipment each. Lands after Drop 3, so there is no embargo to police and nothing to leak.', 'Printer (TLC)'],
  ['Saturday 14 November', '2026-11-14', 'DROP 3 — Cover 3 and the limited holographic Cover 3B live online and in the promo stores.', 'All'],
  ['Monday 16 November', '2026-11-16', 'WIDER WAVE RECEIVED — all four covers on sale everywhere. Ship every held Full Set bundle as a single parcel; reconcile reserve by cover; release secondary selects.', 'Ops / Outlander'],
]

async function main() {
  const issue = await prisma.magazinePlan.findUnique({ where: { issueNumber: ISSUE_NUMBER } })
  if (!issue) throw new Error(`No MagazinePlan with issueNumber ${ISSUE_NUMBER}`)
  console.log(`Issue ${issue.issueNumber} — ${issue.issueName}\n`)

  // Full replacement. Cascade deletes every child row.
  const existing = await prisma.rolloutPlan.findUnique({ where: { magazinePlanId: issue.id } })
  if (existing) {
    await prisma.rolloutPlan.delete({ where: { id: existing.id } })
    console.log('Deleted the v1 plan and all of its rows.')
  }

  const plan = await prisma.rolloutPlan.create({
    data: {
      magazinePlanId: issue.id,
      totalPrintRun: RUN,
      launchDate: d('2026-11-01'),
      warehouseDeadline: d('2026-10-16'),
      gbpToUsd: 1.27,
      eurToUsd: 1.08,
      eastCoastShare: 55,
      shippingUpliftPct: 0,
      b2bFreightPerShipment: 45,
      usHubRunningCost: 0,
      lastYearUsRateGbp: 33,
      printCompleteDate: d('2026-10-02'),
      leadTimeWeeks: 3,
      promoDaysBeforeDrop1: 5,
      widerDaysAfterLastDrop: 2,
      hubToStoreTransitDays: 4,
    },
  })

  const dropIds: Record<string, string> = {}
  for (const [i, dr] of DROPS.entries()) {
    const row = await prisma.rolloutDrop.create({ data: { planId: plan.id, ...dr, sortOrder: i } })
    dropIds[dr.name] = row.id
  }

  for (const [i, c] of COVERS.entries()) {
    await prisma.rolloutCover.create({
      data: {
        planId: plan.id,
        name: c.name,
        subject: c.subject,
        sku: c.sku,
        sharePct: c.sharePct,
        isBalancer: c.isBalancer,
        dropId: dropIds[c.drop],
        notes: 'notes' in c ? (c as { notes?: string }).notes : null,
        sortOrder: i,
      },
    })
  }

  for (const [i, w] of WAVES.entries()) {
    await prisma.stockistWave.create({ data: { planId: plan.id, ...w, sortOrder: i } })
  }

  const hubIds: Record<string, string> = {}
  for (const [i, h] of HUBS.entries()) {
    const row = await prisma.fulfilmentHub.create({ data: { planId: plan.id, ...h, sortOrder: i } })
    hubIds[h.name] = row.id
  }

  for (const [i, r] of RATE_CARDS.entries()) {
    await prisma.fulfilmentRateCard.create({
      data: {
        planId: plan.id,
        hubId: hubIds[r.hub],
        currency: r.currency,
        orderFee: r.orderFee,
        itemPick: r.itemPick,
        isPlaceholder: r.isPlaceholder,
        source: r.source,
        sortOrder: i,
      },
    })
  }

  const profileIds: Record<string, string> = {}
  for (const [i, p] of PROFILES.entries()) {
    const row = await prisma.coverProfile.create({
      data: { planId: plan.id, name: p.name, splits: p.splits, isDefault: p.isDefault, notes: p.notes, sortOrder: i },
    })
    profileIds[p.name] = row.id
  }

  for (const [i, c] of CHANNELS.entries()) {
    await prisma.rolloutChannel.create({
      data: { planId: plan.id, name: c.name, units: c.units, kind: c.kind, purpose: c.purpose, hubId: c.hub ? hubIds[c.hub] : null, sortOrder: i },
    })
  }

  for (const [i, t] of TERRITORIES.entries()) {
    await prisma.rolloutTerritory.create({
      data: { planId: plan.id, name: t.name, hubId: hubIds[t.hub], b2cUnits: t.b2cUnits, seedingVip: t.seedingVip, sortOrder: i },
    })
  }

  for (const [i, e] of EVENTS.entries()) {
    await prisma.rolloutEvent.create({
      data: { planId: plan.id, city: e.city, hubId: hubIds[e.hub], units: e.units, notes: e.notes, sortOrder: i },
    })
  }

  for (const [i, l] of LANES.entries()) {
    await prisma.shippingLane.create({ data: { planId: plan.id, ...l, sortOrder: i } })
  }

  for (const [i, s] of STOCKISTS.entries()) {
    await prisma.stockist.create({
      data: {
        planId: plan.id,
        name: s.n,
        city: s.city,
        market: s.market,
        hubId: hubIds[s.hub],
        profileId: profileIds[s.profile],
        units: s.units,
        tier: s.tier,
        isReserved: s.reserved ?? false,
        // Promo accounts need paperwork; everyone else doesn't.
        embargoStatus: s.tier === 'PRIMARY' && !s.reserved ? 'SENT' : 'NOT_REQUIRED',
        sortOrder: i,
      },
    })
  }

  // Milestones 4, 12 and 16 are the only ones the sheet marks off the critical
  // path — slipping any of the rest moves the launch date.
  const OFF_CRITICAL_PATH = new Set([4, 12, 16])
  for (const [i, [window, date, action, owner]] of MILESTONES.entries()) {
    const seq = i + 1
    await prisma.rolloutMilestone.create({
      data: {
        planId: plan.id,
        seq,
        window,
        date: d(date),
        action,
        owner,
        criticalPath: !OFF_CRITICAL_PATH.has(seq),
        status: 'NOT_STARTED',
      },
    })
  }

  await verify(plan.id)
}

async function verify(planId: string) {
  const p = await prisma.rolloutPlan.findUniqueOrThrow({
    where: { id: planId },
    include: {
      covers: { orderBy: { sortOrder: 'asc' } },
      drops: { orderBy: { sortOrder: 'asc' } },
      waves: { orderBy: { sortOrder: 'asc' } },
      rateCards: true,
      profiles: true,
      hubs: { orderBy: { sortOrder: 'asc' } },
      channels: true,
      territories: { orderBy: { sortOrder: 'asc' } },
      stockists: true,
      events: true,
      lanes: true,
    },
  })

  const input = {
    ...p,
    profiles: p.profiles.map((x) => ({ ...x, splits: x.splits as Record<string, number> })),
  } as unknown as PlanInput

  const fmt = (v: number) => `$${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const day = (x: Date | null) =>
    x ? x.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'

  console.log('\n── Drops ──')
  for (const r of dropSchedule(input)) {
    console.log(`  ${r.drop.name.padEnd(7)} ${day(r.goLiveAt)}  live ${String(r.unitsLive).padStart(5)}  cumulative ${String(r.cumulativeLive).padStart(5)}  in store ${String(r.stockistUnitsInStore).padStart(4)}  [${r.covers.map((c) => c.name).join(' + ')}]`)
  }

  console.log('\n── Territory holds ──')
  const holds = territoryDropHolds(input)
  for (const t of p.territories) {
    const h = p.drops.map((dr) => String(holds[t.id][dr.id] ?? 0).padStart(5)).join(' ')
    console.log(`  ${t.name.padEnd(26)} B2C ${String(t.b2cUnits).padStart(5)} →${h}`)
  }

  console.log('\n── Waves ──')
  for (const w of waveSchedule(input)) {
    console.log(`  ${w.wave.name.padEnd(18)} ${String(w.stores).padStart(2)} stores  ${String(w.units).padStart(5)} units  dispatch ${day(w.dispatchBy)}  in store ${day(w.inStoreBy)}  embargo ${w.embargoDays ?? '—'}d`)
  }

  const clock = printClock(input)
  console.log(`\n── Print clock ──\n  Print complete ${day(clock.printCompleteDate)} + ${clock.leadTimeWeeks}wk → earliest in store ${day(clock.earliestInStore)}`)
  console.log(`  First wave needs ${day(clock.firstWaveInStore)} → headroom ${clock.headroomDays} day(s) — ${clock.feasible ? 'FEASIBLE' : 'NOT FEASIBLE'}`)

  console.log('\n── Warehouses ──')
  for (const h of hubTotals(input)) {
    console.log(`  ${h.hub.name.padEnd(13)} B2C ${String(h.b2cAndGifting).padStart(5)}  events ${String(h.events).padStart(4)}  stockists ${String(h.stockists).padStart(5)}  reserve ${String(h.reserveAndBuffer).padStart(5)}  = ${String(h.total).padStart(6)} (${h.sharePct.toFixed(1)}%)`)
  }

  // ── Economics ──
  const ny = p.lanes.find((l) => l.name.includes('New York'))
  const la = p.lanes.find((l) => l.name.includes('Los Angeles'))
  const blended = blendedUsLaneUsd(input, { nyLaneId: ny?.id, laLaneId: la?.id })
  const usCard = rateCardFor(input, p.hubs.find((h) => h.name === 'US (SLC)')!.id)
  const basket = basketEconomics(input, blended, usCard)
  const usVolume = p.territories
    .filter((t) => ['US', 'Canada', 'South America'].includes(t.name))
    .reduce((s, t) => s + t.b2cUnits, 0)

  console.log(`\n── US basket economics ──  blended lane ${fmt(blended!)}, US volume ${usVolume.toLocaleString()}`)
  for (const b of basket) {
    console.log(`  ${b.items} magazine(s)  ${fmt(b.totalUsd).padStart(9)}  per magazine ${fmt(b.perMagazineUsd).padStart(9)}  saved ${fmt(b.savedUsd).padStart(9)}`)
  }

  const scenarios = scenarioCosts(input, usVolume, basket)
  console.log('\n── Scenarios ──')
  for (const s of scenarios) {
    console.log(`  ${s.label.padEnd(36)} ${fmt(s.costUsd).padStart(12)}  saved ${fmt(s.savedVsWorstUsd).padStart(12)}`)
  }

  const yoy = yearOnYear(input, usVolume, basket, scenarios[1])
  console.log('\n── Versus last year ──')
  console.log(`  Last year, UK → US, per order   ${fmt(yoy.lastYearPerOrderUsd!).padStart(10)}   total ${fmt(yoy.lastYearTotalUsd!).padStart(12)}`)
  console.log(`  This year, ex-SLC, per order    ${fmt(yoy.thisYearPerOrderUsd!).padStart(10)}   total ${fmt(yoy.thisYearTotalUsd!).padStart(12)}`)
  console.log(`  Warehouse saving                                ${fmt(yoy.warehouseSavingUsd!).padStart(12)}`)
  console.log(`  Bundling upside (basket of 2)                   ${fmt(yoy.bundlingUpsideUsd!).padStart(12)}`)
  console.log(`  TOTAL SAVING                                    ${fmt(yoy.totalSavingUsd!).padStart(12)}`)

  const freight = stockistFreight(input)
  console.log('\n── Stockist freight ──')
  console.log(`  Planned: ${freight.shipments} shipments   ${fmt(freight.costUsd)}`)
  console.log(`  One delivery per store per drop: ${freight.perDropShipments} shipments   ${fmt(freight.perDropCostUsd)}`)
  console.log(`  Saved: ${fmt(freight.savedUsd)}`)

  const ph = placeholderAudit(input)
  console.log(`\n── Assumptions to confirm (${ph.total}) ──`)
  for (const i of ph.items) console.log(`  • ${i}`)

  console.log('\n── Reconciliation ──')
  let bad = 0
  for (const c of reconcile(input)) {
    if (!c.ok) bad++
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.label.padEnd(42)} ${String(c.result).padStart(7)} vs ${String(c.target).padStart(7)}  Δ${c.variance}`)
    if (c.note) console.log(`      ${c.note}`)
  }
  console.log(bad === 0 ? '\nAll checks tie.' : `\n${bad} CHECK(S) FAILED.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
