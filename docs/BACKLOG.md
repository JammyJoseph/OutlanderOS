# OutlanderOS — Backlog

Recovered 2026-07-27 by auditing the codebase, git history and the four markdown files in
the repo. Until now this list existed only in chat sessions. **Keep it here.**

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

- [ ] **Prisma migrations.** No `prisma/migrations/` — schema ships via `db push` against
      prod, with no version history, no rollback and no review of destructive changes. For a
      schema holding finance and HR data this is the highest-risk item after secrets.
      Baseline from current prod state.
- [ ] **Any test suite at all.** Zero tests, zero test runner. 139 API routes verified only
      by manual clicking. Start with the money paths: auth, budget maths, call-sheet
      publishing, Xero sync.
- [ ] **CI.** No `.github/`, no pre-commit hooks, no build gate. Deploy is `git pull` on the
      live box. At minimum: typecheck + lint + build on PR.
- [ ] **Error tracking and alerting.** No Sentry/Datadog/OTel. A prod 500 leaves one line in
      `/root/.pm2/logs` on a box nobody watches. `/api/health` is well built but nothing
      polls it. `pm2 max_restarts: 10` means a crash-loop ends with the app **permanently
      down, silently**.
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

## 2. Integrations

See `docs/ARCHITECTURE.md` for the full picture. Headline: **Google is integrated three
incompatible ways and most of its surface is dead code.**

- [ ] **Consolidate Google auth onto per-user OAuth** (`src/lib/google-user-auth.ts` — the
      only one that refreshes properly). Retire the `.tokens.json` app-level client and the
      service account. Delete or finish `google-client.ts` (5 exported functions, zero
      callers), `drive-search.ts` (zero importers), `getUserGmail` (zero callers).
- [ ] **Fix the two hardcoded `localhost:3000` redirect URIs** — `xero-client.ts:5` and
      `google-user-auth.ts:14`. Derive from `NEXTAUTH_URL`. The Google one currently forces
      users to copy an auth code out of a connection-refused URL bar; **Xero OAuth cannot
      complete in production at all as written.**
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
