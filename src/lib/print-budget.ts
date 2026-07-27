// ===== Print budget (section-based) shared model =====
// Mirrors Quinn's issue budget spreadsheet: a flat list of PrintBudgetLine rows
// grouped into fixed sections. Imported by both the API (server) and the Budget
// tab (client), so it stays free of server-only imports. VAT is never included —
// the platform rule is that budget figures always exclude VAT.

export type PrintBudgetSection =
  | 'MAGAZINE_PRODUCTION'
  | 'FREELANCE'
  | 'PRODUCTIONS'
  | 'EVENTS'
  | 'MARKETING'
  | 'OTHER'

// Display order + labels for the collapsible sections.
export const PRINT_BUDGET_SECTIONS: { key: PrintBudgetSection; label: string; blurb: string }[] = [
  { key: 'MAGAZINE_PRODUCTION', label: 'Magazine Production', blurb: 'Pre-press, printing, proofs & courier' },
  { key: 'FREELANCE', label: 'Freelance Editors & Designers', blurb: 'Named freelancers, designers & writers' },
  { key: 'PRODUCTIONS', label: 'Productions', blurb: 'Produced features — auto-linked from the flat plan' },
  { key: 'EVENTS', label: 'Events', blurb: 'Hero events & activations' },
  { key: 'MARKETING', label: 'Marketing', blurb: 'OOH, displays, seeding & activations' },
  { key: 'OTHER', label: 'Other / Additional', blurb: 'One-off costs that fit nowhere else' },
]

export const PRINT_BUDGET_SECTION_LABELS: Record<PrintBudgetSection, string> = Object.fromEntries(
  PRINT_BUDGET_SECTIONS.map((s) => [s.key, s.label]),
) as Record<PrintBudgetSection, string>

export function isPrintBudgetSection(v: string): v is PrintBudgetSection {
  return PRINT_BUDGET_SECTIONS.some((s) => s.key === v)
}

// The standard Magazine Production items that repeat every issue. "Set up from
// template" seeds exactly these (skipping any already present). Amounts are the
// house defaults from Quinn's sheet — editable per issue after seeding.
export const MAGAZINE_PRODUCTION_TEMPLATE: { description: string; amount: number }[] = [
  { description: 'Pre-Press / Colour Management', amount: 10000 },
  { description: 'Physical Fogra Epson Colour Proofs', amount: 5000 },
  { description: 'Correction & Amends', amount: 1000 },
  { description: 'Reproof/Corrections', amount: 1000 },
  { description: 'Gatefold Proofs', amount: 1000 },
  { description: 'Gatefold Retouch', amount: 1000 },
  { description: 'Courier', amount: 1000 },
  { description: 'Magazine Production (10000 Units)', amount: 60000 },
  { description: 'Magazine Corner (10000 units)', amount: 1500 },
]

// A budget line as returned by the API. `amount` is the BUDGET row on the cost
// ledger; `actual` is the SUM of ACTUAL rows attributed to it, computed server
// side (see lib/cost-ledger.ts).
//
// There used to be a resolvedActual() helper here that chose between a manually
// typed actual and a linked production's actual. That choice is gone: budget and
// actual are separate ledger rows, so the actual is a sum, and the client simply
// displays it.
export interface PrintBudgetLine {
  id: string
  section: PrintBudgetSection | string
  description: string
  amount: number // budgeted, ex-VAT
  actual: number // summed from ACTUAL ledger rows; 0 when nothing has been spent
  notes: string | null
  productionId: string | null
  productionTitle: string | null // resolved title of the linked production, if any
  // Xero coding — null until the chart of accounts can be fetched.
  accountCode: string | null
  accountName: string | null
  sortOrder: number
}

export interface SectionTotals {
  section: PrintBudgetSection | string
  budget: number
  actual: number
  variance: number // budget − actual
  lineCount: number
}

export interface BudgetGrandTotals {
  budget: number
  actual: number
  variance: number
  revenue: number | null // issue revenue, if set
  headroom: number | null // revenue − budget (null when no revenue set)
  headroomPct: number | null
}

export function sectionTotals(lines: PrintBudgetLine[]): SectionTotals {
  let budget = 0
  let actual = 0
  for (const l of lines) {
    budget += l.amount || 0
    actual += l.actual || 0
  }
  return {
    section: lines[0]?.section ?? 'OTHER',
    budget,
    actual,
    variance: budget - actual,
    lineCount: lines.length,
  }
}

export function grandTotals(lines: PrintBudgetLine[], revenue: number | null): BudgetGrandTotals {
  let budget = 0
  let actual = 0
  for (const l of lines) {
    budget += l.amount || 0
    actual += l.actual || 0
  }
  const headroom = revenue != null ? revenue - budget : null
  return {
    budget,
    actual,
    variance: budget - actual,
    revenue,
    headroom,
    headroomPct: revenue != null && revenue > 0 ? (headroom! / revenue) * 100 : null,
  }
}

// Groups lines by section in the canonical display order; empty sections are
// still returned so the UI can render an "add first line" affordance.
export function groupBySection(lines: PrintBudgetLine[]): { key: PrintBudgetSection; label: string; blurb: string; lines: PrintBudgetLine[] }[] {
  return PRINT_BUDGET_SECTIONS.map((s) => ({
    ...s,
    lines: lines
      .filter((l) => l.section === s.key)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.description.localeCompare(b.description)),
  }))
}
