<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# OutlanderOS

Internal operating system for Outlander Magazine. ~7 staff users. Next.js 16 (App Router) +
Prisma 7 + Postgres, deployed as a single `next start` process under pm2 on one VPS.

**Read `docs/ROADMAP.md` for what's next and in what order, `docs/BACKLOG.md` for the
itemised detail, and `docs/ARCHITECTURE.md` for how the pieces fit.** This file is conventions and landmines only.

## Product shape

Two route groups, different headers and different audiences:

- `src/app/(portal)/` — the business portals: `commercial` (deals, clients, media plans, IOs),
  `production` (briefs, call sheets, budgets, crew), `print` (flat plan, distribution),
  `finance` (admin-only), `directory` (contacts, IG scanning), `admin`, `think-tank`.
- `src/app/(dashboard)/me/` — the personal workspace: dashboard, tasks, holiday, profile, settings.

The dashboard is the single source for pointers, tasks and suggestions. Notifications were
deliberately removed (commit `239334d`) — do not reintroduce a notification bell.

## Auth

Custom email/password → bcrypt (10 rounds) → 30-day JWT in an httpOnly `auth_token` cookie.
NextAuth is installed and partly configured but is **not** the live login path.

- Page gating: `src/proxy.ts` (Next 16's renamed middleware). Public paths are allowlisted
  explicitly — `/login`, `/reset-password`, `/auth/google/callback`, `/call-sheet/*`.
  **Anything not listed redirects to `/login`.** New public pages must be added there.
- API gating: each route calls `getCurrentUser()` or the `withAuth`/`withAdmin` wrappers in
  `src/lib/auth.ts`. 130 of 139 routes authenticate; the 9 that don't are intentional.
- **The JWT bakes `role` in at login.** A user promoted to ADMIN still carries `MEMBER` until
  they sign in again. Server-side role gates must use `isAdminInDb(user)`, never
  `user.role === 'ADMIN'`. This has caused real bugs ("can't unlock budget as admin").
- `proxy.ts` decodes the JWT with `atob` **without verifying the signature** — it is a UX
  redirect, not a security boundary. Real enforcement is `requireAdminPage()` in the
  `finance` and `admin` layouts.

## Data conventions

- **Archiving sets an `archived` boolean, not a status enum.** Filter `archived: false` or
  counts silently include archived rows (has caused `/me` and dashboard miscounts).
- **Deactivating a user sets `isActive: false`.** There is no `deactivatedAt` column. The
  password column is `password`, not `passwordHash`.
- Production colour-coding keys off `billingType`, not `type` (`type === COMMERCIAL` locks
  the budget).
- Bump `SEED_VERSION` to push flat-plan seed edits to prod.

## Schema changes — read this before touching `prisma/schema.prisma`

**Migrations are now live** (baselined 2026-07-27 as `prisma/migrations/0_init`). Prod and
local are both marked up to date. Use migrations, not `db push`:

```
# after editing schema.prisma
DATABASE_URL="postgresql://work@localhost:5432/outlanderos" npx prisma migrate dev --name what_changed
# review the generated SQL, commit it, then on prod:
npx prisma migrate deploy
```

- **`migrate dev` fails outright in a non-interactive shell** (any agent session). When it
  would prompt — which includes every data-loss warning — generate the SQL by hand instead:

  ```
  npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script \
    > prisma/migrations/<timestamp>_<name>/migration.sql
  npx prisma migrate deploy
  ```

- **Prisma 7 renamed the `migrate diff` flags.** `--from-database` → `--from-config-datasource`,
  `--to-schema-datamodel` → `--to-schema`. The old names exit non-zero with an empty script, so
  a redirect leaves you a 0-byte migration that `migrate deploy` accepts silently. Check the
  byte count.
- **`prisma migrate diff` needs `DATABASE_URL` set even for `--from-empty`** — without it the
  command silently emits nothing rather than erroring.
- `npm run build` is plain `next build` and applies nothing. A schema change deployed without
  a migrate step ships code querying a column prod doesn't have → runtime 500s, not build
  errors.
- Never hand-edit an applied migration. Add a new one.
- Daily backups run at 3am via `/usr/local/bin/backup-outlanderos.sh` (server-side, 30-day
  retention). Run it manually before anything destructive.
- Legacy note: `db push` **halts** on anything it considers data loss — dropping a non-empty
  table, *or adding a `@unique` column*. If you ever fall back to it, reproduce against the
  local DB first rather than discovering it mid-deploy.

## Redirects from API routes

**Never build a redirect from `request.url` in a route handler.** Behind nginx it
resolves to the address the app listens on, not the hostname the browser asked for, and
the forwarded scheme gets stapled to it — `NextResponse.redirect(new URL('/x',
request.url))` produced `https://localhost:3000/x` and an `ERR_SSL_PROTOCOL_ERROR` page
at the end of a *successful* Google OAuth connection (fixed 2026-09-03 in
`api/google/callback`). Emit a relative `Location` instead:

```ts
new NextResponse(null, { status: 307, headers: { Location: '/me/settings' } })
```

The browser resolves it against the URL it actually requested, so it is right on every
hostname including local dev. `proxy.ts` has never had this problem because middleware
normalises its redirects to relative paths.

## Styling

Live theme is **Paper Standard** (light). `.dark` class-remap in `globals.css` is a
deliberate safety net — do not delete it until the per-file `dark:` sweep is complete and
browser-verified. Primary buttons are black, not brass. Accents come from `--portal-*` vars
and `src/lib/design.ts`.

CSS compiler quirks: `@media screen` gets stripped (use bare `@media`), `:root` inside
`@media` does not work, and the var tint-shade remap flips opacity variants.

## Working in this repo

- **Never `git add -A`.** Concurrent sessions share this working tree and `.claude/worktrees/`
  carries ~50 stale deletions. Stage only the files you touched, by path.
- Author files with the Write tool, not shell heredocs — heredocs hang on large files.
- `npx tsc --noEmit` has ~80 pre-existing errors and `next.config.ts` sets
  `ignoreBuildErrors: true`, so **the build passing does not mean the types are clean**.
  Filter to your own files rather than comparing raw error counts.
- `npm run dev` 404s every route locally on some machines. A production build
  (`npm run build && npm start`) works and is the reliable way to verify UI locally.
- `npm run db:seed` is broken (`TypeError` reading 'ADMIN'). Create fixtures with a one-off
  tsx script; `PrismaClient` needs the `PrismaPg` adapter (Prisma 7, no `url` in schema).

## Deploy

```
ssh root@204.168.245.185
cd /var/www/outlanderos
git checkout -- package-lock.json   # server npm installs rewrite it and block the pull
git pull origin main                # DO NOT pipe this — see below
npm install
# Read the URL from .env.local — NEVER hardcode the password. It was rotated in
# Aug 2026 and a stale hardcoded URL made `migrate deploy` fail while the chain
# carried on, shipping code that queried a column prod didn't have.
export DATABASE_URL="$(grep '^DATABASE_URL' .env.local | cut -d= -f2-)"
npx prisma migrate deploy && npx prisma generate   # NOT db push — migrations are live
export NODE_OPTIONS="--max-old-space-size=3584" && npm run build && pm2 restart outlanderos
git log --oneline -1                # confirm this matches what you pushed
psql "$DATABASE_URL" -t -c 'select migration_name from "_prisma_migrations" order by finished_at desc limit 1;'
#                                   ^ confirm the newest migration actually applied — do not
#                                     trust `tail`ed migrate output, same masking family as
#                                     the piped pull below
```

**Never pipe `git pull` into `tail` inside an `&&` chain.** A pipeline's exit status is
`tail`'s, so an aborted pull is masked: the chain rebuilds and restarts the *old* code and
prints `DONE`. This has already caused a deploy that silently shipped nothing. Always check
`git log --oneline -1` on the server afterwards.

Assets under `public/` need only a `git pull` — prod runs plain `next start`. Pulls abort on
untracked-file collisions on the server.

`NEXTAUTH_SECRET` lives in `.env.local` on prod (not `.env`, not the process env). To test
prod APIs, mint a JWT with it and pass it as the `auth_token` cookie.
