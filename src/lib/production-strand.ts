// Which strand of the business a production belongs to, for the Projects list.
//
// There was no single field for this: `type` is EDITORIAL|COMMERCIAL and
// `billingType` is EDITORIAL|PAID, so nothing separated Print from Digital
// Editorial and nothing marked White Label. Rather than invent a field and
// backfill it by guesswork, a project's strand is DERIVED from signals that
// already exist, and `Production.strand` overrides that derivation whenever
// someone sets it explicitly.

export type Strand = 'PRINT' | 'DIGITAL_EDITORIAL' | 'WHITE_LABEL' | 'PAID'

export const STRANDS: { key: Strand; label: string; blurb: string }[] = [
  { key: 'PRINT', label: 'Print', blurb: 'Shoots commissioned for an issue' },
  { key: 'DIGITAL_EDITORIAL', label: 'Digital Editorial', blurb: 'Our own editorial, not for print' },
  { key: 'WHITE_LABEL', label: 'White Label', blurb: 'Produced for someone else’s brand' },
  { key: 'PAID', label: 'Paid', blurb: 'Commercial work behind a deal' },
]

export const STRAND_LABELS: Record<Strand, string> = Object.fromEntries(
  STRANDS.map((s) => [s.key, s.label])
) as Record<Strand, string>

export function isStrand(v: string): v is Strand {
  return STRANDS.some((s) => s.key === v)
}

export interface StrandInput {
  strand?: string | null
  billingType?: string | null
  type?: string | null
  campaignId?: string | null
  /** True when any of the project's cost lines sit in an issue budget. */
  inIssueBudget?: boolean
}

// Order matters. An explicit strand always wins; after that, being commissioned
// for an issue is the strongest signal, because that's a fact about the work
// rather than a billing classification.
export function strandOf(p: StrandInput): Strand {
  if (p.strand && isStrand(p.strand)) return p.strand
  if (p.inIssueBudget) return 'PRINT'
  if (p.campaignId || p.type === 'COMMERCIAL' || p.billingType === 'PAID') return 'PAID'
  return 'DIGITAL_EDITORIAL'
}

// True when the strand was derived rather than set. The UI marks these so it's
// obvious which rows are a guess and which someone has confirmed — otherwise a
// wrong grouping looks like fact.
export function strandIsDerived(p: StrandInput): boolean {
  return !(p.strand && isStrand(p.strand))
}
