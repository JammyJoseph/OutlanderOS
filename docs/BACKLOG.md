# OutlanderOS — Backlog

Recovered 2026-07-27 by auditing the codebase, git history and the four markdown files in
the repo. Until now this list existed only in chat sessions. **Keep it here.**

**See `docs/ROADMAP.md` for the order to do these in.** This file is the itemised
list with file:line detail; the roadmap sequences it by dependency — most of it sits
behind one DNS record.

Status key: `[ ]` open · `[~]` partial · `[x]` done

---

## 0. Security — do these first

Verified against live prod on 2026-07-27.

- [ ] 🔴 **PRODUCTION HAS NO TLS.** nginx listens on port 80 only; no 443 listener, no
      certificate, `server_name` is the bare IP `204.168.245.185`. Every staff login sends
      the password in cleartext, every request sends the 30-day session cookie in cleartext,
      and password-reset links cross the wire in the clear. Anyone on the network path — café
      wifi, ISP, any hop — can read credentials and steal sessions. **This outranks
      everything else in this file.** Blocked on pointing a domain at the IP (Let's Encrypt
      will not issue for a bare IP), then certbot + an nginx 443 server block + redirecting
      80→443, then setting `NEXTAUTH_URL` to the `https://` origin.
- [x] ~~Rotate the two committed API keys~~ — **fallbacks removed from source** (2026-07-27).
      Both routes now read env-only and degrade cleanly when unset. ⚠️ **Still to do: rotate
      both at the provider** — they remain in git history. OpenWeather: regenerate at
      openweathermap.org. Telegram: `/revoke` at BotFather.
- [x] ~~Remove the `NEXTAUTH_SECRET` fallback~~ — all 7 sites now call `getJwtSecret()`
      (`src/lib/jwt-secret.ts`), which throws when the var is unset. Resolved lazily, not at
      module load, so a missing secret is a clear runtime error rather than a build failure.
- [x] ~~Fix the dot-path proxy bypass~~ — `src/proxy.ts` now matches a real static-asset
      extension list. Verified: `/finance/x.y` redirects to `/login`; assets still serve.
- [x] ~~Add `secure` + `sameSite` to the auth cookie~~ — `src/lib/auth-cookie.ts`.
      `sameSite: 'lax'` always; `secure` derived from `NEXTAUTH_URL` so it switches itself on
      the moment TLS lands (hardcoding it now would lock everyone out over HTTP).
      **A CSRF token still does not exist anywhere in the app** — `sameSite` is the only
      cross-site protection today.
- [x] ~~Patch dependency CVEs~~ — **both criticals gone** by deleting the vestigial
      `next-auth` surface (the `@auth/core` advisory was reachable via the live
      unauthenticated `/api/auth/[...nextauth]` route). Removed `next-auth`,
      `@auth/prisma-adapter`, the catch-all route, the dead `/auth/signin` page, `authOptions`
      and `SessionProvider`. `next` and `prisma` deliberately left at their pinned versions:
      the remaining `next`/`postcss`/`sharp` advisories have **no patched release** (npm's
      suggested "fix" is a downgrade to Next 9), and bumping prisma past 7.8 moves *into* a
      vulnerable range. Remaining highs are the eslint dev toolchain — build-time only.
- [ ] **Purge `BILLING_PASSWORD` / `Q_PASSWORD`** — plaintext human account passwords in
      prod `.env.local`, read by no code.
- [ ] **Encrypt or relocate `.tokens.json`.** Plaintext Google + Xero OAuth refresh tokens on
      disk in `process.cwd()`, read-modify-write with no locking, write failures swallowed
      silently. Xero rotates refresh tokens on every use, so one lost write **permanently**
      breaks the Xero connection. Move into the DB, encrypted, with atomic writes.
- [ ] Stop logging the password-reset token in plaintext to pm2 logs
      (`api/auth/forgot-password/route.ts:48`) once email delivery exists.

## 1. Engineering safety net

The architecture is sounder than the tooling around it. This is the real gap.

- [x] ~~Prisma migrations~~ — **baselined 2026-07-27** as `prisma/migrations/0_init`. Verified
      prod had zero drift from `schema.prisma` first, then confirmed the generated migration
      rebuilds the schema exactly on a scratch database (51 tables, 6 enums, 47 FKs) before
      marking it applied on prod and local. Use `prisma migrate dev` / `migrate deploy` now,
      not `db push`. Note: `migrate diff` silently emits nothing if `DATABASE_URL` is unset.
- [ ] **Any test suite at all.** Zero tests, zero test runner. 139 API routes verified only
      by manual clicking. Start with the money paths: auth, budget maths, call-sheet
      publishing, Xero sync.
- [ ] **CI.** No `.github/`, no pre-commit hooks, no build gate. Deploy is `git pull` on the
      live box. At minimum: typecheck + lint + build on PR.
- [~] **Error tracking and alerting.** Partly done 2026-07-27:
      - [x] pm2 no longer dies permanently — `min_uptime: 60s` means the restart counter only
            advances for genuinely unstable restarts, plus exponential backoff. `pm2 save`d.
      - [x] `/api/health` is now polled every 5 min by `/usr/local/bin/outlanderos-healthcheck.sh`,
            which restarts pm2 if the process is gone and alerts on state changes only.
            Both the healthy and failure paths were tested. See `docs/RUNBOOK.md`.
      - [ ] **Set `ALERT_WEBHOOK_URL` in `/etc/outlanderos-watchdog.env`** — without it,
            alerts only reach `/var/log/outlanderos-health.log`, which nobody reads. Any
            Slack/Discord webhook works. This is a 2-minute job with outsized value.
      - [ ] Still no *application* error tracking. The watchdog catches down/degraded, not
            500s. Wants Sentry (free tier) — needs an account + `SENTRY_DSN`.
      - [ ] Rehearse a database restore. Backups run nightly but have never been restored.
- [ ] **Retire `ignoreBuildErrors: true`** (`next.config.ts:16-18`) — currently hiding ~80
      type errors, several of them genuine Next 16 route-signature drift. Ratchet down.
- [ ] **Adopt Zod for request validation.** Zod is already a dependency and used nowhere;
      most routes destructure `request.json()` straight into Prisma.
- [ ] Add try/catch to the 34 routes without it (incl. `/api/auth/login` — a malformed JSON
      body is an unhandled 500 today).
- [ ] Structured logging — `src/lib/logger.ts` exists but only 6 files use it, against 112
      raw `console.*` calls.
- [ ] Bound the 86 unbounded `findMany` calls; `src/lib/pagination.ts` exists but is barely
      adopted.

## 1b. Cost ledger — finish the migration

The `CostLine` ledger landed 2026-07-27 (see `docs/ARCHITECTURE.md`). Print runs on it;
two budget systems still sit outside it.

- [x] ~~`CostLine` ledger~~ — BUDGET/COMMITTED/ACTUAL as separate rows, coding dimension,
      non-exclusive context (issue / production / deal), drawdown link, invoice ref.
      `resolvedActual()` deleted. `PrintBudgetLine` dropped (was empty).
- [x] ~~Issue 02 imported~~ — 62 rows, £634,868.95, exactly the sheet total. 14 produced
      shoots linked to production projects. Importer is idempotent
      (`prisma/import-issue02-budget.ts`).
- [ ] **Merge the 3 duplicate-looking production projects.** The importer refused to guess
      and created new projects for Bottega Veneta — Louise Trotter, Peggy Gou — Bag
      Collection, and Sorel — Heat Reactive Paw Prints. Existing candidates: two Bottega
      projects, "Peggy Gou Digital Cover Story", and **two identically-named "Soggy Sucks"**
      plus "SOREL - All Weather Walkies". Someone who knows the work must decide; relink the
      budget row's `productionId` and archive the surplus project.
- [x] ~~Migrate `BudgetLineItem` into the ledger~~ — **done 2026-07-27.** Each row became a
      BUDGET CostLine plus, where `actual > 0`, an ACTUAL row drawn against it. The data move
      and the `DROP TABLE` are in ONE migration
      (`20260727150000_migrate_budget_items_into_ledger`) — split apart, there is a window
      where deployed code reads the ledger while the data is still in the old table, and a
      standalone script can't read a table the Prisma client no longer models. The migration
      reconciles both totals in SQL and raises rather than dropping on a shortfall.
      All 8 read sites converted; the legacy bridge in `cost-ledger.ts` is gone.
      `BudgetTab.tsx` (2,343 lines) was **not touched** — the API keeps its legacy `items`
      shape and only the storage moved.
- [ ] **Migrate `CampaignBudget` (4 rows) into the ledger.** Its four coarse buckets
      (production / media / internal / other) become coded BUDGET rows against the deal.
- [ ] **Issue revenue should roll up from deals, not be typed in.** `MagazinePlan.totalRevenue`
      is currently a single manual figure (set to £680,032 for Issue 02 from the sheet). Tab 2
      of Quinn's sheet is really a list of commercial deals — Porsche, Vans, Chanel, Omega,
      Timberland, Sorel, MCM, Penhaligons, Bulgari, Armani, Balmain — each with an "IO Signed?"
      flag that the IO maker already models. Tag deals to an issue and the revenue side gets
      the same red thread as the cost side.
- [ ] **Backfill Xero account codes** once Xero is reconnected (§2). Every `CostLine` has
      `accountCode` / `trackingCategory` waiting. `section` is the natural thing to map onto a
      real tracking option.
- [ ] Finance P&L view over the unfiltered ledger — `totalsByAccount()` in `cost-ledger.ts`
      exists and is unused. Uncoded rows deliberately surface rather than hide.

## 1c. Productions view + budget UX (requested 2026-07-27)

- [x] ~~Rebuild the Productions view as a list, delete the tile view~~ — **done 2026-07-27.**
      One table grouped by strand (Print · Digital Editorial · White Label · Paid) with
      status, shoot date, budget, spent, headroom and lead per row. Soonest shoot first,
      falling back to most recently updated. `ProjectCard` and the client grouping are gone.
      **The grouping blocker was resolved by deriving rather than guessing** — see
      `src/lib/production-strand.ts`. A project with a cost line in an issue budget is PRINT;
      one with a deal / COMMERCIAL type / PAID billing is PAID; the rest are DIGITAL_EDITORIAL.
      `Production.strand` overrides the derivation, and derived rows are marked "auto" in the
      UI so a guess never reads as fact.
      - [x] ~~White Label picker~~ — **done 2026-07-27.** Strand selector sits beside the
            status pill on the project header. "Auto — <derived>" shows what the derivation
            would pick, so it isn't a black box; choosing a strand overrides it. An invalid
            value clears the override rather than storing junk. Verified: setting White Label
            moves the project into that section of the Projects list.
- [x] ~~Upcoming view shows budget, headroom and project manager~~ — **done 2026-07-27.**
      Each upcoming shoot row now carries the lead's name alongside client and call time, and
      budget with remaining headroom on the right (over-budget in red). Hidden on narrow
      screens so the countdown chip keeps its space.
- [x] ~~Drag-and-drop reordering in the production budget~~ — **done 2026-07-27.** Lines drag
      within their section; sections drag by their heading. Plain HTML5 drag events rather
      than a library — the rows are a flat list and a DnD dependency wasn't worth the bundle.
      Lines use the ledger's existing `sortOrder`; sections needed somewhere to live, so
      `Production.budgetSectionOrder` stores a per-production order (empty = house order, and
      sections missing from a saved order keep their house position at the end, so adding a
      new section never makes it vanish on a reordered production).
      Both endpoints validate: the line reorder ignores ids belonging to another production
      and respects the budget lock; the section order drops unknown keys rather than storing
      them. Verified both guards.
- [x] ~~Undo "fill from template"~~ — **done 2026-07-27.** "Undo template (n)" appears beside
      "Fill template", only when there is something to undo. Removes lines still blank from
      the template; anything with a figure, description, note, invoice tracking **or recorded
      spend** is kept. Verified: seeded 66, filled 3, undo removed exactly 63 — including
      correctly keeping a £0 line that had an actual against it.
      Caveat: lines migrated from the old `BudgetLineItem` table had their blank descriptions
      backfilled from `role` (CostLine.description is NOT NULL), so pre-migration template
      rows read as "filled in" and are not removed. Only affects budgets seeded before
      2026-07-27.
- [x] ~~Budget export omits unused lines~~ — **done 2026-07-27.** `BudgetDocument` drops rows
      with no money, no spend and no description, then hides any section left empty. A
      deliberate £0 line with a description still prints. The footer discloses how many rows
      were omitted — silently dropping lines from a financial document isn't acceptable.
- [x] ~~Print budget revenue tied to deals~~ — **done 2026-07-27.** Issue revenue is now the
      sum of the DISTINCT deals linked on that issue's flat plan (distinct matters: a deal
      spanning a DPS appears on two pages and must count once). `MagazinePlan.totalRevenue`
      becomes explicit "other income" and the two are **added**, never chosen between — so
      neither can silently mask the other.
      ⚠️ **Neither issue has any deals linked on its flat plan yet** (0 campaignIds across
      Issue 02's 279 pages), so deal revenue reads £0 and the £680,032 sits in other income.
      The budget tab says so plainly rather than showing a confident zero. Linking the 13
      advertisers on the flat plan is the remaining data job — the code is ready.
      Free-form lines for marketing/freelancers/kill fees already work: the ledger takes
      plain rows in any section.

## 1d. IO signature workflow (DocuSign)

- [x] ~~Send IOs for signature from the Commercial portal~~ — **built 2026-07-27, not yet
      proven against a live account.** JWT Grant auth, envelope from template, status polling,
      guards. See `docs/DOCUSIGN.md`. Before today "Send" only stamped a status — nothing left
      the building, and there is still no mail library in the project.
- [ ] **Provide the four DocuSign credentials** (integration key, user id, RSA private key,
      template id) and grant consent once. Until then the Send button returns a clear
      "not connected" message.
- [ ] **Build the IO template in DocuSign** with the tab labels in `docs/DOCUSIGN.md`, signer
      role `Client`. The template's line-row count is a hard limit — the send route refuses
      rather than truncating a contract.
- [ ] **Go-live certification** — ~20 successful demo calls then a DocuSign review before
      production envelopes are legally binding. Days, not hours.
- [ ] **Webhooks once TLS lands.** Connect needs an HTTPS callback and prod has no 443, so
      status is polled via a Refresh button. Add a Connect subscription writing the same
      fields when the certificate exists; polling then becomes the fallback.
- [ ] Store the completed PDF. `downloadSignedPdf()` exists and `signedPdfUrl` is on the
      model, but nothing calls it yet — needs a decision on where files live (Drive vs
      `public/uploads`, which is lost on server rebuild).

## 1e. Rollout & distribution (built 2026-07-29)

- [x] ~~Fulfilment and distribution strategy in the print portal~~ — the spreadsheet built
      in: covers/SKUs, channel allocation, regional warehouse model, B2C territory split,
      53 stockists with cover profiles, launch events, shipping lanes and the milestone
      calendar. Everything editable; everything derived stays derived (`src/lib/rollout.ts`).
- [x] ~~**v2: three drops, two waves, full economics**~~ (2026-07-29). The v1 plan was
      replaced by a fresh seed rather than migrated — territory splits and cover profiles both
      changed shape, so mapping old buckets onto new ones would have tied to nothing.
      What's new:
      - **`RolloutDrop`** — release dates, *not* delivery dates. All 4,000 B2C units reach the
        warehouses once, before Drop 1; a drop is a rule in the ecommerce platform. Modelling
        it as logistics would invent three shipments and triple the freight forecast.
      - **`StockistWave` + `Stockist.tier`** — one delivery per store. Tier is the only input;
        wave, in-store date, dispatch date and embargo days all derive from it. 53 shipments
        against 149. Control comes from *who* holds stock early (12 accounts under embargo),
        not from how often you ship.
      - **The print clock** — print date + lead time gives the earliest possible in-store date.
        Headroom is currently 4 days. Negative headroom turns the page red and names the wave
        that no longer fits; it's a feasibility check, not an allocation one.
      - **`FulfilmentRateCard` + basket economics** — order fee is per parcel, item pick is per
        magazine. That asymmetry is the whole bundling argument: a Full Set customer saves
        $35.47 against four separate orders, and bundling to an average basket of two saves
        $11,588 across the US pool.
      - **`isPlaceholder`** on lanes and rate cards — 4 rates are still assumptions, surfaced
        as a count and an amber banner. The $73,120 headline saving depends on them.
      Twelve reconciliation checks now, including wave units, promo-account range, signed
      embargo agreements and print-clock headroom.
- [x] ~~**TLC ships every stockist direct.**~~ (2026-07-30) All 53 trading accounts now sit on
      the `Direct (TLC)` hub, not the regional warehouses — previously only the 5 Asia-Pacific
      cartons were direct and the other 2,790 units were wrongly counted at UK/EU/US. The
      regional warehouse count is now 7,000 (B2C, gifting, events and the reserve); TLC holds
      3,000. This also makes the warehouse table agree with the print clock, which already
      ran three weeks from *print completion* to in-store rather than from a warehouse.
      A reconciliation check guards it, since the store's hub is a dropdown.
      **Assumption to confirm with TLC:** they hold the B2B allocation on the print floor from
      2 October until each wave dispatches — 3 weeks for the promo wave, 6 for the wider one.
- [ ] **Decide where the 750-unit reserve lives.** Kept at the UK hub, on the reasoning that
      replenishment and secondary selects from 16 November cannot ship off a print floor months
      after the run. If TLC will warehouse it, move it to the direct hub and the regional count
      drops to 6,250.
- [ ] **Re-quote B2B freight now it is all ex-printer.** The $45/shipment placeholder was a
      blend of ex-warehouse and ex-printer lanes; every shipment now originates at TLC, so it
      should be one quotable rate (or a per-region set) rather than a blended guess.
- [ ] **Chase the 12 signed embargo agreements.** Tracked per stockist (`embargoStatus`), all
      currently `SENT`. The check fails until every promo account has signed — deliberately,
      since the wave can't dispatch without them.
- [ ] **Confirm the 4 placeholder rates**: the EU (NL) rate card, UK domestic, EU domestic and
      UK→rest-of-world lanes. Until then the saving figures are provisional.
- [ ] **Link stockists to the Directory.** `Stockist.contactId` exists and is unused — the 53
      outlets are currently a second address book. Wiring it means commercial and print share
      one record per account, and the promo 12 become a real chase list.
- [ ] **Shipping lanes should post to the cost ledger.** Lane cost (rate × volume) is real
      spend against the issue and belongs on `CostLine` as BUDGET rows, so distribution shows
      up in the issue P&L rather than only here. Blocked on nothing — just not done.
- [ ] Cover-level stock tracking (received / picked / remaining per hub) once the fulfilment
      partner is appointed and there's real inventory to track.
- [ ] Milestone owners are free text. Could link to `User` for real assignment and a
      "my deadlines" view.

## 1f. Sales reporting (built 2026-07-30)

- [x] ~~**Shopify sales dashboard** at `/print/sales-reports`~~ — reads the store's order
      history and reports it back against the rollout plan rather than as generic sales
      figures, because Shopify Analytics already does the latter better. Basket profile,
      sell-through by cover, demand by territory, US coast split, sales curve and repeat
      buyers, each shown against the plan's current assumption. See `docs/SHOPIFY.md`.
- [ ] **BLOCKED — install the app on the store.** `Outlanderosconnect-1` is registered but
      not installed, so token exchange returns `app_not_installed`. Settings → Apps →
      Develop apps → Build apps in Dev Dashboard → Installs → Install app.
- [ ] **BLOCKED — `read_all_orders` approval.** Without it Shopify returns only the last 60
      days, which for an annual drop is usually zero orders. Requested via Dev Dashboard →
      API access → Request access; Shopify reviews manually.
- [ ] **Rotate the Shopify client secret.** It was shared in a chat transcript during setup.
      Dev Dashboard → app → Settings → rotate, then update prod `.env.local`.
- [ ] **Check the Shopify variant SKUs match the print plan** (`OUT02-C1` …). Cover-level
      analysis joins on SKU; anything without one lands in a visible `(no SKU)` bucket.
- [ ] **Write recommendations back into the rollout plan.** The dashboard surfaces suggested
      cover shares and territory splits but you retype them into Distribution. A one-click
      "apply to plan" is the obvious next step, and deliberately not built until the numbers
      have been sanity-checked against a real drop.
- [ ] **Schedule the sync.** Runs on a button today. Once installed, a daily run via the
      existing sync engine (`SyncStatus` source `shopifyOrders`) would keep it warm.

## 1f. Print credit consent (built 2026-08-05)

- [x] ~~Contributor credit-confirmation flow in the Print Directory~~ — one tokenised
      public page per person (`/credit/[token]`, same pattern as crew invoices): plain-English
      confidentiality agreement → reveal of what the Directory is → confirm name / handle /
      email / address → consent recorded with agreement version and timestamp. Address is
      delivery-only: staff response drawer only, never the public payload, never print.
      Admin panel under Directory → Print Directory → Name credits: sheet import (235 people,
      41 bad emails surfaced as fixable), status tracking, per-row and bulk send.
      **Sends are structurally test-only until `CREDIT_SEND_LIVE=true` is set on prod** —
      every email redirects to silver@outlandermag.com with the intended recipient in the
      subject. Mailchimp rejected: transactional needs the paid Mandrill add-on; the existing
      SMTP mailer already does per-recipient tokens from our own domain.
- [ ] **Lawyer pass on the agreement copy** before the real sendout (`AGREEMENT_VERSION`
      bumps if it changes, so signed versions stay attributable).
- [ ] **Fix the 41 bad emails** in the panel (inline edit) — `*`, bio links, missing TLDs.
- [ ] **Go live**: set `CREDIT_SEND_LIVE=true` on prod, reset any test-status rows, send.
- [ ] Reminder pass for non-responders (remindedAt exists; no scheduled job yet).

## 1h. Smart tips (built 2026-08-06)

- [x] ~~Smart-tip system~~ — two mechanisms, deliberately distinct. Passive tips
      (`src/lib/smart-tips.ts` registry + `<SmartTip id/>`): dismissible once per user,
      stored on `User.seenTips` so "got it" follows people across devices; API validates
      ids against the registry. Guardrails: interstitials that fire EVERY time a suspect
      action happens, never dismissible-forever. Adding a tip = one registry entry + one
      component drop.
- [x] ~~Paid-shoot guardrail~~ — creating a production with billing PAID interjects:
      deals tracked in Commercial land in Production with budget allocated from the deal
      and the IO linked. Offers "Track it in Commercial instead" / "create here anyway".
- [x] Seeded tips: paid-via-Commercial (productions list), roster ordering (call sheet
      editor), budget-vs-actuals discipline (cost tracking view).
- [ ] **The wrap endpoint has no UI.** `POST /api/productions/[id]/wrap` (crew invoice
      emails, built with the invoice flow) has no button anywhere in the front end — found
      while placing a wrap tip. Add a Wrap action on the production page once shoot dates
      pass, then a smart tip pointing at it.
- [ ] More tip candidates as workflows land: distribution reconciliation reading, credit
      test-mode reminder for new staff, Shopify CSV backfill.

## 1g. Held until TLS (see ROADMAP Phase 1b)

Neither is technically blocked. Both are held because shipping them over
cleartext would put *other people's* data on the wire, which is a different kind
of mistake from putting our own there.

- [ ] **External collaborator access.** Scoped, expiring, per-project grants so
      outside producers can see budgets, cost tracking and call sheets for one
      production. Collaborators are **not `User` rows and never touch the staff
      API** — an `EXTERNAL` role would mean retrofitting a guard onto 139 routes
      and one miss exposes the company's finances. Separate `/api/collab/*`
      surface, separate cookie, magic-link invites via the existing mailer,
      mandatory expiry, instant revocation, audit log. Scopes derive from the
      session, never the request. Read-only first; cost submission second, on
      the path already built for crew invoices.
      **Rejected:** two-way Excel sync — conflict resolution, schema drift and
      no audit trail on the ledger. Build a tokenised read-only XLSX endpoint
      their sheet refreshes from instead: one-way, always current.
- [ ] **Concierge.** New tab on the production project for talent and crew
      movement — pickups, flights, hotels, timings — with a shareable PDF for
      management teams. Owns almost no data: people from Team, times from Call
      Sheets. **Conflict detection is the point, not the PDF** — "lands 14:20,
      call time 14:00", "checkout 11:00, flight 21:40, 10 hours unaccounted".
      Reuses the tokenised public-page pattern and the `.print-doc` export.
      Waits for TLS because the shared link carries flight numbers, hotels, room
      numbers and pickup times for named people; talent location data in the
      clear is a personal-safety problem before it is a security one.
      **Open question:** are guests opt-in per person, or derived from Team?

## 2. Integrations

See `docs/ARCHITECTURE.md` for the full picture. Headline: **Google is integrated three
incompatible ways and most of its surface is dead code.**

- [ ] **Consolidate Google auth onto per-user OAuth** (`src/lib/google-user-auth.ts` — the
      only one that refreshes properly). Retire the `.tokens.json` app-level client and the
      service account. Delete or finish `google-client.ts` (5 exported functions, zero
      callers), `drive-search.ts` (zero importers), `getUserGmail` (zero callers).
- [ ] 🔴 **Xero is dead in production right now, and cannot be revived without a code fix.**
      Verified 2026-07-27: a Xero token exists in `.tokens.json`, but `/api/xero/data`
      returns `{"connected":false,"error":"Token expired — please reconnect Xero in
      Settings"}`. Reconnecting runs the OAuth flow, whose redirect URI is hardcoded to
      `http://localhost:3000/api/xero/callback` (`xero-client.ts:5`), so **the flow cannot
      complete from the production URL.** Every finance figure sourced from Xero is
      therefore stale or absent, and the account codes / tracking categories needed for
      budget coding can't be fetched at all.
      Also found: `expires_at` is written in **milliseconds** where the refresh check reads
      **seconds** (`.tokens.json` shows year 58292), so the proactive refresh never fires —
      the connection only ever dies rather than renewing.
      Same hardcoded-localhost bug in `google-user-auth.ts:14`, which is why connecting
      Google makes users copy an auth code out of a connection-refused URL bar. Derive both
      from `NEXTAUTH_URL`.
- [ ] **Collapse three Xero clients into one** (`xero-finance.ts` is the best). Delete
      `xero-api.ts` and the report half of `xero-client.ts`; they duplicate token refresh
      almost verbatim. Also: admin-gate `/api/xero/connect` (any authenticated user can
      currently overwrite the org-wide Xero token), and fix `getXeroBankSummary` mapping
      `reportingCode` into a field called `balance`.
- [ ] **Handle revoked Google grants gracefully.** `getUserGoogleTokens` throws on
      `invalid_grant`, and `withAuth` (`auth.ts:145-155`) doesn't wrap the handler — so a
      revoked token is an unhandled 500 instead of a "reconnect Google" prompt.
- [ ] **`GOOGLE_SERVICE_ACCOUNT_EMAIL` is not set on prod**, so the directory Sheets import
      (`/api/directory/import-sheet`) throws hard. Either set it or finish the migration off
      the service account.
- [ ] Apply the existing `src/lib/retry.ts` to Google, Xero and Apify — it's currently used
      in exactly one place (the RSS ingester).
- [ ] Move the Apify token out of the query string into an `Authorization: Bearer` header
      (`instagram-apify.ts:75,289`) — it currently lands in Apify's access logs.
- [ ] Schedule `/api/think-tank/ingest`. There is no cron anywhere in the repo, so editorial
      signals only refresh when someone clicks.
- [ ] Move rate limiting off the in-memory `Map` (`src/lib/rate-limit.ts:11`) before running
      more than one instance. It also trusts `x-forwarded-for` unconditionally.
- [ ] **Transactional email.** No mail library is installed at all; every "email" in the app
      is a `mailto:` link. Blocks self-service password reset (see §4).
- [ ] Delete `src/lib/telegram.ts` or wire it up — 42 lines, zero importers.

## 3. Stubbed features (deliberately inert UI that exists today)

| Feature | Location | Size |
|---|---|---|
| MOSS expense integration — empty frame, `Connect MOSS` disabled | `(portal)/finance/_components/ExpensesTab.tsx:46-59` | L |
| Wize cash position — `Connect Wize` disabled | `(portal)/finance/_components/DashboardTab.tsx:67-81` | L |
| Lighthouse (Spotlight + Radar) — 147-line page, both tabs locked behind "Coming Soon"; intended as public-facing | `(portal)/directory/lighthouse/page.tsx:82-147` | L |
| Client portal invitations — popover says "coming soon" | `(portal)/commercial/clients/[id]/page.tsx:148-165` | L |
| Campaign report export + client share — both buttons disabled | `(portal)/commercial/reports/page.tsx:62-76` | M |
| Media plan PDF export + share — disabled (PDF pattern already exists from budgets/IOs) | `(portal)/commercial/media-plans/[id]/page.tsx:262-278` | M |
| Instagram *analytics* (distinct from the working Apify scanner) | `(portal)/admin/settings/SettingsClient.tsx:389-401` | M |
| My Calendar — 11-line "coming soon" page | `(dashboard)/me/calendar/page.tsx:6-8` | M |
| Add Client — button disabled, **and `/api/clients` has no POST handler** | `(portal)/commercial/clients/page.tsx:124-131` | S–M |

## 4. Product follow-ups

- [ ] **Self-service password reset.** Shipped 2026-07-27 but admin-mediated: the link is
      returned only to a signed-in admin and otherwise read from pm2 logs. This is deliberate
      (see the `password-reset-admin-gated-link` note) — the fix is real email delivery, not
      loosening the gate.
- [ ] Per-user weather/brief location — London is hardcoded (`api/dashboard/brief/route.ts:6`).
- [ ] Holiday approval workflow (README Phase 2, never built).
- [ ] Decide whether push/Slack alerts return. `@slack/web-api` is a dependency with zero
      references; `.env.example` declares Slack vars nothing reads.

## 5. Housekeeping

- [x] ~~Confirm `ANTHROPIC_API_KEY` on prod~~ — **set**; the LLM shot-list parser is live,
      not falling back to regex. (Open question in `PRODUCTION_CHECKLIST.md` since 1 Jul.)
- [ ] Walk the remaining `PRODUCTION_CHECKLIST.md` items against prod — all 12 still unticked.
- [ ] **Rewrite `README.md`** — describes the old dark gold theme and a `(dashboard)` route
      structure that no longer exists. Actively misleading.
- [ ] Regenerate `.env.example` from real usage: it omits 9 of the 16 vars the app reads and
      lists Slack vars nothing uses.
- [ ] Drop dead deps: `three`, `@react-three/fiber`, `@react-three/drei` (~600KB, zero
      imports), `@slack/web-api`.
- [ ] `package.json:2` name is `"elastic-diffie"` — a leftover worktree codename.
- [ ] Purge the ~50 committed `.claude/worktrees/` paths (already gitignored) so
      `git status` is readable.
- [ ] Check `.claire/worktrees/festive-jones-61844d/.../production/briefs/page.tsx` — a
      briefs page that exists only in an orphaned worktree and was never merged. Possibly
      lost work.
