/**
 * Imports Quinn's Issue 02 (SS26) budget spreadsheet into the cost ledger.
 *
 * Run:  DATABASE_URL=... npx tsx prisma/import-issue02-budget.ts [--apply]
 *
 * Without --apply it is a dry run and writes nothing.
 *
 * Strategy agreed with Joe:
 *   • Non-production sections import flat as BUDGET rows on the issue.
 *   • Produced shoots become Production projects, linked to their budget row so
 *     actuals flow from the production rather than being typed twice.
 *
 * Linking rule: a produced shoot is linked to an EXISTING production only on an
 * exact title match. Anything that merely looks similar is left unlinked and
 * reported, because silently attaching a cost to the wrong project is the kind of
 * error that quietly corrupts a P&L. There are already two "Soggy Sucks" (Sorel)
 * projects and two Bottega projects, so fuzzy matching here would be a coin flip.
 *
 * Re-running is safe: the script keys on (issue, section, description) and skips
 * anything already present.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const APPLY = process.argv.includes('--apply')
const ISSUE_NUMBER = 2

type Flat = { section: string; description: string; amount: number; notes?: string }

// ── Sections that import as plain budget rows ──────────────────────────────
const MAGAZINE_PRODUCTION: Flat[] = [
  { section: 'MAGAZINE_PRODUCTION', description: 'Pre-Press / Colour Management', amount: 10000 },
  { section: 'MAGAZINE_PRODUCTION', description: 'Physical Fogra Epson Colour Proofs', amount: 5000 },
  { section: 'MAGAZINE_PRODUCTION', description: 'Correction & Amends', amount: 1000 },
  { section: 'MAGAZINE_PRODUCTION', description: 'Reproof/Corrections', amount: 1000 },
  { section: 'MAGAZINE_PRODUCTION', description: 'Gatefold Proofs', amount: 1000 },
  { section: 'MAGAZINE_PRODUCTION', description: 'Gatefold Retouch', amount: 1000 },
  { section: 'MAGAZINE_PRODUCTION', description: 'Courier', amount: 1000 },
  { section: 'MAGAZINE_PRODUCTION', description: 'Magazine Production (10000 Units)', amount: 60000 },
  { section: 'MAGAZINE_PRODUCTION', description: 'Magazine Corner (10000 units)', amount: 1500 },
]

const FREELANCE: Flat[] = [
  { section: 'FREELANCE', description: 'Ali Mohammed [Editor] (April - August)', amount: 10000 },
  { section: 'FREELANCE', description: 'Freelance Graphic Designer 1', amount: 1500 },
  { section: 'FREELANCE', description: 'Freelance Graphic Designer 2', amount: 1500 },
  { section: 'FREELANCE', description: 'Freelance Graphic Designer 3', amount: 2000 },
  // The sheet lists 19 identical £250 writer rows. Kept as individual rows so
  // each can be named and invoiced against as writers are commissioned.
  ...Array.from({ length: 19 }, (_, i) => ({
    section: 'FREELANCE',
    description: `Freelance Writer ${i + 1}`,
    amount: 250,
  })),
]

const EVENTS: Flat[] = [
  { section: 'EVENTS', description: 'Hero Event — NYC', amount: 300000 },
  { section: 'EVENTS', description: 'Hero Event — Los Angeles', amount: 10000 },
  { section: 'EVENTS', description: 'Hero Event — Tokyo', amount: 10000 },
]

const MARKETING: Flat[] = [
  { section: 'MARKETING', description: 'OOH Marketing Phase 1', amount: 10000 },
  { section: 'MARKETING', description: 'OOH Marketing Phase 2', amount: 20000 },
  { section: 'MARKETING', description: 'OOH Marketing Phase 3', amount: 5000 },
  { section: 'MARKETING', description: 'Premium Store Displays', amount: 20000 },
  { section: 'MARKETING', description: 'Sticker Activation', amount: 500 },
  { section: 'MARKETING', description: 'Seeding', amount: 10000 },
]

// Costed rows in the PRODUCTIONS block that aren't produced shoots — supplied
// features and the two covers. The covers carry no type, photographer or date in
// the sheet, so they stay flat rather than being invented as projects.
const PRODUCTIONS_FLAT: Flat[] = [
  { section: 'PRODUCTIONS', description: 'Cover 1', amount: 30000, notes: 'From sheet; no shoot detail given — link to a production when known' },
  { section: 'PRODUCTIONS', description: 'Cover 2', amount: 30000, notes: 'From sheet; no shoot detail given — link to a production when known' },
  { section: 'PRODUCTIONS', description: 'Community — Hong Kong', amount: 2000, notes: 'Supplied' },
  { section: 'PRODUCTIONS', description: 'Community — Mumbai', amount: 5000, notes: 'Supplied · Diya to annotate once designed' },
  { section: 'PRODUCTIONS', description: 'Community — Mexico / Mongolia', amount: 2000, notes: 'Supplied' },
  { section: 'PRODUCTIONS', description: 'Community — Kenya', amount: 2000, notes: 'Supplied · 1st June' },
]

const OTHER: Flat[] = [
  { section: 'OTHER', description: 'Tegan — Porsche Stickers', amount: 1000, notes: 'Additional freelancer' },
]

// ── Produced shoots → Production projects ──────────────────────────────────
type Shoot = {
  title: string // production project title
  feature: string // as written in the sheet
  amount: number
  photographer?: string
  shootDate?: string
  client?: string
}

const SHOOTS: Shoot[] = [
  { title: 'O. Ad — Grass Scratch and Sniff', feature: 'GRASS SCRATCH AND SNIFF', amount: 1000, photographer: 'Olive', shootDate: 'July' },
  { title: 'Bottega Veneta — Louise Trotter Profile', feature: 'LOUISE TROTTER PROFILE', amount: 4000, photographer: 'Olive', shootDate: 'July', client: 'Bottega Veneta' },
  { title: 'Outlander Archive — Still Life', feature: 'OUTLANDER ARCHIVE', amount: 4118.95, photographer: 'Sam Nicklin', shootDate: '16th June' },
  { title: 'Lucien Pages — Working For An Icon', feature: 'WORKING FOR AN ICON AND BECOMING ONE', amount: 2500, photographer: 'Olive', shootDate: 'July 19th' },
  { title: 'Furniture Market — Where Iconic Pieces End Up', feature: 'WHERE ICONIC PIECES END UP', amount: 1000, photographer: 'Olive', shootDate: '23rd May' },
  { title: 'Peggy Gou — Bag Collection', feature: 'BAG COLLECTION', amount: 20000, photographer: 'Olive', shootDate: 'TBC', client: 'Peggy Gou' },
  { title: 'Sorel — Heat Reactive Paw Prints', feature: 'HEAT REACTIVE PAW PRINTS AND FOOTPRINT', amount: 15000, client: 'Sorel' },
  { title: 'Vans — SZA Feature', feature: 'SZA FEATURE', amount: 10000, client: 'Vans' },
  { title: 'Behind The Craft — Ding Zuyin', feature: 'DING ZUYIN', amount: 1000, photographer: 'Ifucktokyo' },
  { title: 'Multi-Brand Murder Mystery Shoot', feature: 'ICONIC PIECES IN A CASTLE', amount: 7500, photographer: 'Neri', shootDate: 'July 1st' },
  { title: 'Saint Laurent — Erotic Photographer', feature: 'EROTIC PHOTOGRAPHER', amount: 0, photographer: 'Roy', client: 'Saint Laurent' },
  { title: 'Kerry Taylor Auction — Iconic Products At Auction', feature: 'Iconic Products At Auction', amount: 1000, photographer: 'Josh Sobel' },
  { title: 'Outlander Comic', feature: 'Comic Book', amount: 6000 },
  { title: 'Timberland (IBC)', feature: 'Timberland', amount: 3000, client: 'Timberland' },
]

// Tokens that indicate an existing project might be the same work. Used only to
// WARN — never to link automatically.
const AMBIGUITY_TOKENS = ['bottega', 'peggy', 'sorel', 'vans', 'timberland', 'porsche', 'swatch']

async function main() {
  const plan = await prisma.magazinePlan.findUnique({ where: { issueNumber: ISSUE_NUMBER } })
  if (!plan) throw new Error(`No MagazinePlan with issueNumber ${ISSUE_NUMBER}`)
  console.log(`Issue ${plan.issueNumber} — ${plan.issueName} (${plan.id})`)
  console.log(APPLY ? 'MODE: APPLY\n' : 'MODE: DRY RUN (pass --apply to write)\n')

  const existing = await prisma.costLine.findMany({
    where: { magazinePlanId: plan.id, kind: 'BUDGET' },
    select: { section: true, description: true },
  })
  const have = new Set(existing.map((e) => `${e.section}::${e.description.trim().toLowerCase()}`))
  const seen = (section: string, description: string) =>
    have.has(`${section}::${description.trim().toLowerCase()}`)

  const allProductions = await prisma.production.findMany({
    select: { id: true, title: true, clientName: true, archived: true },
  })

  // ── 1. Flat sections ──
  const flat = [...MAGAZINE_PRODUCTION, ...FREELANCE, ...PRODUCTIONS_FLAT, ...EVENTS, ...MARKETING, ...OTHER]
  let flatCreated = 0
  const bySection = new Map<string, number>()
  for (const row of flat) {
    if (seen(row.section, row.description)) continue
    const so = bySection.get(row.section) ?? 0
    bySection.set(row.section, so + 1)
    if (APPLY) {
      await prisma.costLine.create({
        data: {
          magazinePlanId: plan.id,
          kind: 'BUDGET',
          section: row.section,
          description: row.description,
          amount: row.amount,
          notes: row.notes ?? null,
          sortOrder: so,
          createdByName: 'Issue 02 sheet import',
        },
      })
    }
    flatCreated++
  }
  console.log(`Flat budget rows: ${flatCreated} to create`)

  // ── 2. Produced shoots ──
  let projectsCreated = 0
  let shootLines = 0
  const ambiguous: string[] = []
  let so = bySection.get('PRODUCTIONS') ?? 0

  for (const shoot of SHOOTS) {
    if (seen('PRODUCTIONS', shoot.title)) continue

    const exact = allProductions.find(
      (p) => p.title.trim().toLowerCase() === shoot.title.trim().toLowerCase()
    )

    let productionId: string | null = exact?.id ?? null

    if (!exact) {
      const token = AMBIGUITY_TOKENS.find((t) => shoot.title.toLowerCase().includes(t))
      const nearby = token
        ? allProductions.filter(
            (p) =>
              p.title.toLowerCase().includes(token) ||
              (p.clientName ?? '').toLowerCase().includes(token)
          )
        : []
      if (nearby.length > 0) {
        ambiguous.push(
          `  "${shoot.title}"\n      possible existing: ${nearby
            .map((n) => `${n.title}${n.archived ? ' (archived)' : ''}`)
            .join(' | ')}`
        )
      }

      if (APPLY) {
        const created = await prisma.production.create({
          data: {
            title: shoot.title,
            clientName: shoot.client ?? 'Outlander Magazine',
            type: 'EDITORIAL',
            billingType: 'EDITORIAL',
            status: 'DRAFT',
            description: [
              `Issue ${plan.issueNumber} (${plan.issueName}) feature: ${shoot.feature}`,
              shoot.photographer ? `Photographer: ${shoot.photographer}` : null,
              shoot.shootDate ? `Shoot date (from sheet): ${shoot.shootDate}` : null,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        })
        productionId = created.id
      }
      projectsCreated++
    }

    if (APPLY) {
      await prisma.costLine.create({
        data: {
          magazinePlanId: plan.id,
          kind: 'BUDGET',
          section: 'PRODUCTIONS',
          description: shoot.title,
          amount: shoot.amount,
          productionId,
          notes: [
            shoot.feature ? `Feature: ${shoot.feature}` : null,
            shoot.photographer ? `Photographer: ${shoot.photographer}` : null,
            shoot.shootDate ? `Shoot: ${shoot.shootDate}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          sortOrder: so++,
          createdByName: 'Issue 02 sheet import',
        },
      })
    }
    shootLines++
  }

  console.log(`Produced shoots: ${shootLines} budget rows, ${projectsCreated} new production projects`)

  if (ambiguous.length > 0) {
    console.log(`\n⚠️  ${ambiguous.length} shoot(s) resemble existing projects and were NOT auto-linked:`)
    console.log(ambiguous.join('\n'))
    console.log('\n  Left as new projects. Merge by hand if any of these are the same work.')
  }

  const sheetTotal =
    flat.reduce((s, r) => s + r.amount, 0) + SHOOTS.reduce((s, r) => s + r.amount, 0)
  console.log(`\nSheet cost total: £${sheetTotal.toLocaleString()}`)

  if (APPLY) {
    const rows = await prisma.costLine.findMany({
      where: { magazinePlanId: plan.id, kind: 'BUDGET' },
      select: { amount: true },
    })
    const dbTotal = rows.reduce((s, r) => s + r.amount, 0)
    console.log(`Ledger total:     £${dbTotal.toLocaleString()}  (${rows.length} rows)`)
    console.log(dbTotal === sheetTotal ? '✓ matches the sheet' : '✗ MISMATCH — investigate')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
