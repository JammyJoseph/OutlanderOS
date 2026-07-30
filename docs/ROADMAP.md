# OutlanderOS — Roadmap

Sequenced by **dependency**, not by priority. `docs/BACKLOG.md` is the full
itemised list with file:line detail; this is the order to do it in and what
blocks what.

Written 2026-07-28.

---

## The critical path, in one picture

```
        ┌── DOMAIN NAME (os.outlandermag.com → 204.168.245.185)
        │
        ├─→ TLS certificate ──┬─→ Secure cookies          (automatic, no code)
        │                     ├─→ DocuSign webhooks       (replaces polling)
        │                     ├─→ Passwords stop crossing the wire in cleartext
        │                     ├─→ EXTERNAL COLLABORATOR ACCESS  (see Phase 1b)
        │                     └─→ CONCIERGE sharing             (see Phase 1b)
        │
        └─→ A real public URL ─┬─→ Fix hardcoded localhost redirect URIs
                               ├─→ XERO reconnect ─→ chart of accounts
                               │                  ─→ backfill CostLine codes
                               │                  ─→ TRUE P&L in Finance
                               ├─→ GOOGLE reconnect ─→ Drive/Sheets stop breaking
                               └─→ MOSS ─→ expenses ─→ ACTUAL rows on the ledger
```

**Everything downstream of the domain is blocked on one DNS record.** You own
`outlandermag.com`, it's on GoDaddy nameservers, and `os.outlandermag.com` is
unused. One A record pointing at `204.168.245.185`, then certbot is ~20 minutes.

---

## Phase 0 — The domain (blocks most of what follows)

| # | Item | Who | Effort |
|---|---|---|---|
| 0.1 | Add A record `os.outlandermag.com` → `204.168.245.185` in GoDaddy | **You** | 5 min |
| 0.2 | certbot + nginx 443 block + 80→443 redirect | Me | 20 min |
| 0.3 | Set `NEXTAUTH_URL=https://os.outlandermag.com` — auth cookie flips to `Secure` on its own | Me | 5 min |
| 0.4 | Verify: cleartext login is no longer possible | Me | 10 min |

Until this lands, every staff login sends the password in the clear, and the
30-day session cookie travels unencrypted on every request.

## Phase 1 — Fix what the URL unblocks

| # | Item | Blocked by | Effort |
|---|---|---|---|
| 1.1 | Derive OAuth redirect URIs from `NEXTAUTH_URL` — `xero-client.ts:5` and `google-user-auth.ts:14` are hardcoded to `localhost:3000` | 0.1 | 1 h |
| 1.2 | Fix the Xero token-expiry units bug — `expires_at` is written in ms and read as seconds, so the proactive refresh never fires and the connection only ever dies | — | 30 min |
| 1.3 | Reconnect Xero (currently dead: token expired, and OAuth can't complete from prod) | 1.1, 1.2 | 15 min |
| 1.4 | Reconnect Google — the current flow makes users copy an auth code out of a connection-refused URL bar | 1.1 | 15 min |
| 1.5 | Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` on prod, or finish moving off the service account. Directory Sheets import throws hard today | — | 30 min |

## Phase 1b — Things deliberately held until TLS exists

Neither of these is technically blocked — both would function over HTTP today.
They are held because shipping them over cleartext would put other people's data
on the wire, and that is a different kind of mistake from putting our own there.

| # | Item | Why it waits for TLS | Effort |
|---|---|---|---|
| 1b.1 | **External collaborator access** — scoped, expiring, per-project grants for outside producers | Invites people outside the company to authenticate. Their session unlocks our cost data, and it would cross the wire in the clear on whatever network they happen to be on | 3–4 days |
| 1b.2 | **Concierge** — talent and crew movement schedules, shareable PDF | The shared link carries flight numbers, hotel names, room numbers and pickup times for named people. Real-time location data for talent, unencrypted, is a personal-safety problem before it is a security one | 1–2 days |

### 1b.1 — External collaborator access, in outline

The design decision that matters: **collaborators are not `User` rows and never
touch the staff API.** Adding an `EXTERNAL` role would mean retrofitting a guard
onto 139 routes, and one miss exposes the company's finances. Instead a separate
surface of roughly six endpoints under `/api/collab/*`, small enough to audit in
one sitting, with its own cookie name so a collaborator session can never be
mistaken for a staff one.

- `Collaborator` (email, name, company) → `CollaboratorGrant` (production,
  scopes, `expiresAt`, `revokedAt`) → `CollaboratorSession` (token, expiry).
- **Magic-link invites, no passwords** — reuses the mailer built for invoices.
  No credential of ours for them to lose.
- Project and scopes derive from the session, **never from the request**, so a
  collaborator cannot reach another production by editing an ID in a URL.
- Mandatory expiry, instant revocation, every action logged.
- **Read-only first.** View budget, view call sheets, pull a live XLSX.
  Cost submission comes second, on the path already built for crew invoices.

On the "auto-updating Excel" idea: a two-way sync is rejected — conflict
resolution, schema drift, and no audit trail on the cost ledger. The version
worth building is a **tokenised read-only XLSX endpoint** their sheet refreshes
from. One-way, always current, and changes come back through the platform.

### 1b.2 — Concierge, in outline

A new tab on the production project, beside Budget and Call Sheets. Owns almost
no data of its own: people come from Team, times and locations from Call Sheets.

- `ConciergeGuest` → `ConciergeSegment` (one table, not one per type — a flight,
  a car and a hotel all have a start, an end, a from, a to and a reference).
- **Conflict detection is the point**, not the PDF. Same pattern as the print
  clock on the distribution tab: *"lands 14:20, call time 14:00"*, *"no pickup
  between landing and call"*, *"checkout 11:00, flight 21:40 — 10 hours
  unaccounted"*. A schedule that tells you when it doesn't work.
- Sharing reuses the tokenised public page pattern from call sheets, and the
  `.print-doc` / `useSinglePagePrint` export.

## Phase 2 — Xero: the coding backbone

This is what turns the ledger from a budget tool into a P&L. Nothing here works
until Xero is actually connected.

| # | Item | Blocked by | Effort |
|---|---|---|---|
| 2.1 | Pull the real chart of accounts + tracking categories | 1.3 | 2 h |
| 2.2 | Account-code picker on cost lines; map print `section` onto a Xero tracking option | 2.1 | 1 d |
| 2.3 | Backfill `accountCode` / `trackingCategory` on the 202 existing CostLines | 2.2 | 4 h |
| 2.4 | Collapse three Xero clients into one (`xero-finance.ts` is the best); delete `xero-api.ts` | — | 1 d |
| 2.5 | Admin-gate `/api/xero/connect` — any authenticated user can currently overwrite the org-wide token | — | 15 min |
| 2.6 | Fix `getXeroBankSummary` mapping `reportingCode` into a field called `balance` | — | 15 min |
| 2.7 | Invoice ingestion → match to `CostLine.invoiceRef`, mark paid | 2.1 | 3 d |
| 2.8 | **Finance P&L over the unfiltered ledger.** `totalsByAccount()` already exists and is unused | 2.3 | 2 d |
| 2.9 | Reconciliation check: ledger ACTUAL total vs Xero for the same period and code. If these disagree you have two sets of books | 2.7 | 1 d |

## Phase 3 — DocuSign: finish what's built

The code is written and deployed; none of it has run against a live account.

| # | Item | Who | Effort |
|---|---|---|---|
| 3.1 | Create developer account, app, RSA keypair; supply the four env vars | **You** | 30 min |
| 3.2 | Build the IO template with the tab labels in `docs/DOCUSIGN.md`, signer role `Client` | **You** | 1 h |
| 3.3 | Grant consent once (the first send returns the exact URL) | **You** | 2 min |
| 3.4 | First sandbox send — the real test. Expect tab-label mismatches | Me | 2 h |
| 3.5 | Go-live certification: ~20 demo calls, then DocuSign reviews the integration | Both | **days** |
| 3.6 | Connect webhooks replacing the Refresh button | 0.2 | 3 h |
| 3.7 | Store the completed PDF — `downloadSignedPdf()` exists, nothing calls it. Needs a decision: Drive, or `public/uploads` (lost on server rebuild) | Decision | 4 h |
| 3.8 | Countersignature step — the IO template currently has one signer role | — | 2 h |

## Phase 4 — MOSS and cash position

| # | Item | Notes | Effort |
|---|---|---|---|
| 4.1 | **Decide the integration shape first.** Moss already integrates natively with Xero. If card spend flows Moss → Xero → us, that's one integration to maintain instead of two, and everything lands pre-coded | Decision | — |
| 4.2 | Confirm API access with Moss — spend platforms often gate the API to specific plans | **You** | — |
| 4.3 | If direct: OAuth/API key, pull transactions, create ACTUAL CostLines coded by merchant category | 4.1, 4.2 | 1 w |
| 4.4 | Receipt capture → attach to the cost line | 4.3 | 3 d |
| 4.5 | Replace the disabled `Connect MOSS` frame in `ExpensesTab.tsx` | 4.3 | 1 d |
| 4.6 | **Clarify "Wize"** on the finance dashboard — if this means Wise (banking/FX), that's a different integration with its own API. The disabled `Connect Wize` frame doesn't say which | Decision | — |

## Phase 5 — Safety net (independent of the domain — can run in parallel)

Nothing here is blocked. It's the difference between a tool that breaks quietly
and one that tells you.

| # | Item | Effort |
|---|---|---|
| 5.1 | **Set `ALERT_WEBHOOK_URL`** in `/etc/outlanderos-watchdog.env` — alerts currently reach a log file nobody reads. Any Slack/Discord webhook | **2 min** |
| 5.2 | **Rehearse a database restore.** Backups run nightly and have never been restored. An untested backup is a hope | 1 h |
| 5.3 | Application error tracking (Sentry free tier) — a prod 500 currently leaves one line in a pm2 log | 3 h |
| 5.4 | A test suite. Zero tests today, 139 routes. Start with the money paths: auth, budget maths, call-sheet publishing, Xero sync | 1 w |
| 5.5 | CI: typecheck + lint + build on PR. No build gate exists; deploy is `git pull` on the live box | 1 d |
| 5.6 | Retire `ignoreBuildErrors: true` — hiding ~80 type errors, several genuine Next 16 route-signature drift | 2–3 d |
| 5.7 | Zod request validation — Zod is a dependency and used nowhere | 3 d |
| 5.8 | try/catch on the 34 routes without it (incl. `/api/auth/login`) | 1 d |
| 5.9 | Structured logging — `logger.ts` used by 6 files vs 112 raw `console.*` | 1 d |
| 5.10 | Bound the 86 unbounded `findMany` calls | 2 d |
| 5.11 | Move rate limiting off the in-memory Map before running >1 instance | 4 h |

## Phase 6 — Remaining security

| # | Item | Who | Effort |
|---|---|---|---|
| 6.1 | **Rotate the OpenWeather and Telegram keys** at their providers — removed from source but still in git history | **You** | 15 min |
| 6.2 | **Purge `BILLING_PASSWORD` / `Q_PASSWORD`** from prod `.env.local` — plaintext human passwords, read by no code | **You** | 5 min |
| 6.3 | Encrypt or relocate `.tokens.json` — plaintext OAuth refresh tokens on disk, swallowed write failures. Xero rotates on every use, so one lost write kills the connection permanently | Me | 4 h |
| 6.4 | CSRF tokens — `sameSite: lax` is the only cross-site protection today | Me | 1 d |
| 6.5 | Stop logging the password-reset token to pm2 logs (needs email first) | Me | 15 min |

## Phase 7 — Transactional email

Blocks self-service password reset and any notification that isn't DocuSign's.

| # | Item | Effort |
|---|---|---|
| 7.1 | Pick and wire a provider (Resend/Postmark/SES). **No mail library is installed at all** — every "email" in the app is a `mailto:` link | 1 d |
| 7.2 | Self-service password reset — currently admin-mediated by design; the fix is delivery, not loosening the gate | 4 h |
| 7.3 | Deal/production notification emails, if wanted | 2 d |

## Phase 8 — Ledger tail

| # | Item | Effort |
|---|---|---|
| 8.1 | **Merge 3 duplicate production projects** — the Issue 02 importer refused to guess: two Bottega, two identically-named "Soggy Sucks", plus "SOREL - All Weather Walkies". Someone who knows the work must decide | 30 min (**you**) |
| 8.2 | **Link the 13 advertisers to Issue 02's flat plan** — deal revenue reads £0 until they are; the £680,032 sits in other income | 1 h (**you**) |
| 8.3 | Migrate `CampaignBudget` (4 rows). It's arguably an allocation record, not duplicate state — but it drives one arbitration (`budgetExVat = prodBudget > 0 ? prodBudget : b.totalBudget`) worth resolving deliberately | 1 d |

## Phase 9 — Product features (stubbed UI that exists today)

Each of these is a disabled button in the live app.

| Feature | Where | Size |
|---|---|---|
| Lighthouse (Spotlight + Radar) — 147-line page, both tabs behind "Coming Soon", intended as public-facing | `directory/lighthouse` | L |
| Client portal invitations | `commercial/clients/[id]` | L |
| Campaign report export + client share | `commercial/reports` | M |
| Media plan PDF export + share — the PDF pattern already exists from budgets/IOs | `commercial/media-plans/[id]` | M |
| Instagram analytics (distinct from the working Apify scanner) | `admin/settings` | M |
| My Calendar — 11-line "coming soon" page | `me/calendar` | M |
| **Add Client — button disabled AND `/api/clients` has no POST handler** | `commercial/clients` | S–M |
| Holiday approval workflow (README Phase 2, never built) | `me/holiday` | M |
| Per-user weather/brief location — London is hardcoded | `api/dashboard/brief` | S |
| Print budget: free-form lines for marketing/freelancers/kill fees (ledger already supports it — UI job) | `print/flat-plan` | M |
| White Label strand picker exists; nothing derives into it by design | — | done |

## Phase 10 — Google consolidation

| # | Item | Effort |
|---|---|---|
| 10.1 | Consolidate onto per-user OAuth (`google-user-auth.ts` — the only one that refreshes properly). Retire the `.tokens.json` app-level client and the service account | 3 d |
| 10.2 | Delete dead surface: `google-client.ts` (5 exports, 0 callers), `drive-search.ts` (0 importers), `getUserGmail`, `getGmailMessages`, `getCalendarEvents`, `getDriveFiles`, `getSheetData` | 2 h |
| 10.3 | Handle revoked grants gracefully — `getUserGoogleTokens` throws on `invalid_grant` and `withAuth` doesn't wrap the handler, so it's an unhandled 500 instead of "reconnect Google" | 4 h |
| 10.4 | Then, if wanted: Gmail and Calendar features become straightforward | — |

## Phase 11 — Housekeeping

| # | Item | Effort |
|---|---|---|
| 11.1 | Apply `retry.ts` to Google, Xero, Apify — used in exactly one place today | 4 h |
| 11.2 | Move the Apify token out of the query string into an `Authorization` header — it lands in Apify's access logs | 30 min |
| 11.3 | Schedule `/api/think-tank/ingest` — no cron in the repo, so editorial signals only refresh on a click | 2 h |
| 11.4 | **Rewrite `README.md`** — describes a dark gold theme and a route structure that no longer exist. Actively misleading | 2 h |
| 11.5 | Regenerate `.env.example` — omits 9 of the 16 vars the app reads, lists Slack vars nothing uses | 30 min |
| 11.6 | Drop dead deps: `three`, `@react-three/fiber`, `@react-three/drei` (~600KB, zero imports), `@slack/web-api` | 30 min |
| 11.7 | `package.json` name is `"elastic-diffie"` — a leftover worktree codename | 2 min |
| 11.8 | Delete `src/lib/telegram.ts` or wire it up — 42 lines, zero importers | 15 min |
| 11.9 | Walk the 12 unticked items in `PRODUCTION_CHECKLIST.md` against prod | 2 h |
| 11.10 | Recover `production/briefs/page.tsx` — exists only in an orphaned worktree, never merged. Possibly lost work | 1 h |

---

## If you only do five things

1. **The DNS record** (5 min, yours) — unblocks TLS, Xero, Google, DocuSign webhooks.
2. **`ALERT_WEBHOOK_URL`** (2 min) — the difference between finding out in five minutes and finding out on Monday.
3. **Rotate the two leaked keys** (15 min, yours).
4. **Rehearse a restore** (1 h) — you have backups you've never proven.
5. **Link the 13 advertisers to the flat plan** (1 h, yours) — makes Issue 02's revenue real rather than a typed-in figure.
