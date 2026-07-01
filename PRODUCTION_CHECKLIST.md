# Production Portal — Post-Build Verification Checklist

Covers everything shipped across the recent production builds. Tick each off in the
live portal after deploy.

## Budget (VAT-exclusive)
- [ ] **Total budget always excludes VAT** — line-item totals, section subtotals and the
      grand "Total Budget (exc. VAT)" all read exc. VAT; per-line VAT shown for info only.
- [ ] **Headroom = Total Budget − Subtotal (exc. VAT)** — the "Budget covers the costs /
      headroom" figure compares the campaign allocation against the **exc-VAT** total
      (`BudgetTab.tsx`, `budgetCoversCosts = campaignBudget − totalExcVat`), never inc-VAT.
- [ ] **Overspend / allocation warnings** compare against exc-VAT + actuals, not inc-VAT.
- [ ] **Budget is hidden from the call sheet** — no budget figures on the call sheet,
      preview, public share, or PDF.

## Call Sheet
- [ ] **Multiple locations** render on the call sheet (movement order, per-stop details).
- [ ] **Deliverables show on the call sheet** — preview tab, published/FinalView, in-app PDF,
      and both public share links (internal + client-redacted) all render the Deliverables
      section, auto-populated from the production Deliverables tab.
- [ ] **Two-way sync** — editing deliverables in the call sheet editor updates the
      Deliverables tab and vice-versa (single `ProductionDeliverable` source of truth).
- [ ] **Deliverable → shot mapping** — linking a shot to a deliverable persists and shows
      on both the shot cards and the deliverable rows.

## AI Paste-and-Parse (`/api/ai/parse-content`)
- [ ] **Shot list paste + parse (LLM)** — pasting any-format text and clicking Parse calls
      the LLM endpoint, shows a loading state, and populates shots + overall style.
- [ ] **Deliverables paste + parse (LLM)** — same flow for the deliverables brief.
- [ ] **Graceful fallback** — with no `ANTHROPIC_API_KEY` (or on any model error) the route
      falls back to the regex parser and the UI still populates.
- [ ] Confirm whether `ANTHROPIC_API_KEY` is set in the prod `.env` (feature is LLM-powered
      only when present; otherwise regex fallback). Model: `claude-sonnet-4-20250514` — see
      note below.

## Campaign Timeline
- [ ] **Campaign Timeline milestones** exist as a separate view from the shoot schedule.

## Internal Sharing
- [ ] **Internal production links** work for `@outlandermag.com` users.
- [ ] Client-redacted share link masks production contact details.

---

### Notes / follow-ups
- **AI model:** the parser is pinned to `claude-sonnet-4-20250514`, which the current
  Anthropic model catalogue lists as **deprecated (retired ~2026-06-15)**. If the endpoint
  starts 404ing, bump `MODEL` in `src/app/api/ai/parse-content/route.ts` to a current model
  (e.g. `claude-sonnet-5`). The route degrades to the regex parser regardless, so this is
  non-blocking.
- **Budget headroom (Issue 1):** already correct exc-VAT in code (`392de6a`); this deploy
  makes it live if prod was on an older build.
