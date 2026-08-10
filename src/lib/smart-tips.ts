// ═══════════════════════════════════════════════════════════════════════════
// Smart tips — the registry.
//
// Two kinds of guidance live on the platform, and they are deliberately not
// the same mechanism:
//
//   • TIPS (this file + <SmartTip/>) — passive, dismissible nudges that teach a
//     workflow the first time someone meets it. Dismissed once, gone forever,
//     per user. A tip that reappears after "got it" trains people to stop
//     reading callouts at all.
//
//   • GUARDRAILS — interstitials that fire EVERY time a suspect action is
//     taken (e.g. creating a paid shoot directly in Productions). Never
//     dismissible-forever, because the second paid shoot created the wrong way
//     is exactly as wrong as the first. They live in the flow they guard, not
//     here.
//
// Adding a tip: one entry here, one <SmartTip id="..."/> where it should
// appear. The id is the contract — the API validates dismissals against this
// registry, so a typo'd id fails loudly instead of storing junk.
// ═══════════════════════════════════════════════════════════════════════════

export interface SmartTipDef {
  title: string
  body: string
  cta?: { label: string; href: string }
}

export const SMART_TIPS: Record<string, SmartTipDef> = {
  'productions-paid-via-commercial': {
    title: 'Paid shoots start life in Commercial',
    body: 'Track the deal in the Commercial pipeline and the production is created for you when it closes, with the budget allocated from the deal and the IO linked for invoicing. Creating a paid shoot directly here leaves it with no deal, no IO and no budget trail.',
    cta: { label: 'Open the Commercial pipeline', href: '/commercial' },
  },
  'callsheet-roster-order': {
    title: 'The roster orders itself',
    body: 'People sort by call time, then by production hierarchy within each time, and the printed sheet uses exactly the order you see. Drag any row to take over the ordering by hand; the list stops re-sorting until you switch it back.',
  },
  'budget-cost-tracking': {
    title: 'Budget and actuals are separate entries',
    body: 'Budget lines are the plan; each cost you log is its own entry against a line, so the variance is always derived and never typed. Log invoices as they arrive rather than editing budget figures to match reality.',
  },
}

export const isSmartTipId = (id: string): boolean =>
  Object.prototype.hasOwnProperty.call(SMART_TIPS, id)
