# OutlanderOS — Architecture

Written 2026-07-27. Scale: ~78k lines across `src/`, 51 pages, 139 API routes, 40 shared
components, 50 lib modules. ~7 users.

## Runtime

One 4GB VPS (`204.168.245.185`). Postgres and the app on the same box. pm2 runs a single
`next start` in fork mode as root (`ecosystem.config.js`), `max_memory_restart: 3G`,
`max_restarts: 10`. No reverse-proxy config, Dockerfile or deploy script is in the repo —
deploy is a manual `git pull` + build + `pm2 restart` on the live server.

**Everything is a single point of failure**, and three pieces of state live outside Postgres:
`.tokens.json` (OAuth credentials), the in-memory rate limiter, and `public/uploads/`
(runtime PDFs). All three are lost on a server rebuild and each independently blocks scaling
past one instance.

## Request path

```
browser → proxy.ts (rate limit /api/*, allowlist public pages, redirect on missing cookie)
        → page  → layout guard (requireAdminPage for finance/admin)
        → route → getCurrentUser() / withAuth / withAdmin → prisma
```

`src/proxy.ts` is Next 16's renamed middleware. It gates *pages*; API routes each gate
themselves. See `AGENTS.md` for the auth rules and the two known proxy weaknesses.

## Data

Prisma 7 with the `PrismaPg` adapter (no `url` in `schema.prisma` — it comes from
`prisma.config.ts`). `src/lib/prisma.ts` uses a lazy-init Proxy, so connection failures
surface at first query rather than at boot.

**No migrations directory.** Schema ships via `db push`. See `AGENTS.md`.

Core models: `User`, `Contact`, `Campaign` (deals), `Production` + `ProductionMilestone` +
`ProductionDeliverable`, `EditorialPiece`, `Task`, `Deadline`, `HolidayRequest`,
`Notification` (model retained, UI removed).

## Integrations — actual state

| Integration | State | Notes |
|---|---|---|
| **Apify / Instagram** | ✅ Best-built | Apify-first → direct scrape → manual. Timeouts, spend cap (25 handles), graceful null-returns, 24h Postgres cache, scraper output sanitised before persistence. |
| **Google Drive** | ✅ Solid | Query escaping, idempotent folder creation, self-healing subfolders, pagination, purpose-built `DriveFolderAccessError`. Per-production per-user folders. No retry/backoff; uploads buffer fully in memory. |
| **OpenWeather** | ✅ Wired | Excellent degradation — returns 200 with `unavailable: true` rather than failing the page. Public call-sheet endpoint correctly scoped to stored coords. |
| **Anthropic** | ✅ Wired | Shot-list/deliverables parser (`claude-sonnet-4-6`, regex fallback) and think-tank reports (`claude-opus-4-7`, fails clean). Both models are a generation behind current. |
| **Xero** | ⚠️ Partial | **Three** implementations of the same API, all live. Redirect URI hardcoded to `localhost:3000` — cannot complete OAuth in prod. Global not per-user, and `/api/xero/connect` is not admin-gated. |
| **Google (other)** | ⚠️ Fragmented | See below. |
| **RSS / think-tank** | ⚠️ Partial | The only integration using `retry.ts`. But ingest is manual-trigger only — no cron exists anywhere. N+1 dedupe. |
| **Telegram** | ❌ Dead | 42 lines, zero importers. |
| **Slack** | ❌ Dead | Dependency + env vars, zero code references. |
| **MOSS, Wize** | ❌ Not started | Disabled UI frames only. |

### The Google problem

The same vendor is integrated **three incompatible ways**, and most of the surface is dead:

1. **Per-user OAuth** (`google-user-auth.ts`) — tokens on the `User` row, real refresh with
   60s skew. The only one done properly. Powers Drive.
2. **App-level OAuth** (`google-client.ts` + `token-store.ts`) — shared accounts, tokens in
   `.tokens.json`, refresh only opportunistically via an SDK event listener. Powers the
   dashboard calendar.
3. **Service account** (`google-sheets.ts`) — env-var JWT, throws hard if unset.
   `GOOGLE_SERVICE_ACCOUNT_EMAIL` **is not set on prod**, so directory Sheets import is broken.

Dead across all three: `getUserGmail`, `getGmailMessages`, `getCalendarEvents`,
`getDriveFiles`, `getSheetData`, and the whole of `drive-search.ts` — zero callers each.
**There is no email scanning in the codebase** despite the file names suggesting it
(`scan-contacts.ts` and `scan-cache.ts` are Instagram, not Gmail).

Consolidating onto (1) is the prerequisite for any further Google work.

## Environment variables

16 read by the app: `ANTHROPIC_API_KEY`, `APIFY_API_KEY`, `APIFY_FOLLOWING_ACTOR`,
`DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PRIVATE_KEY`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NODE_ENV`,
`OPENWEATHER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `XERO_CLIENT_ID`,
`XERO_CLIENT_SECRET`.

Prod sets all except `GOOGLE_SERVICE_ACCOUNT_EMAIL`. `NEXTAUTH_SECRET` is in `.env.local`
only. `.env.example` is stale — it omits 9 of the 16 and lists Slack vars nothing reads.

## Frontend

Client-heavy: 143 client components, 225 `fetch()` calls in `.tsx`, 59 of them in
`useEffect`. Worst waterfalls: `directory/page.tsx` (14 fetches),
`commercial/deals/[id]/page.tsx` (13). **No caching layer** — zero `unstable_cache`, zero
`revalidate`, no React `cache()`, while 27 routes are `force-dynamic`. **Zero `loading.tsx`**,
so every waterfall shows as a blank.

Error boundaries exist at every layout level, which is good. Theme is Paper Standard (light);
see `AGENTS.md` for the CSS compiler quirks.
