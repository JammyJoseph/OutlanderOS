<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# OutlanderOS

Internal operating system for Outlander Magazine. ~7 staff users. Next.js 16 (App Router) +
Prisma 7 + Postgres, deployed as a single `next start` process under pm2 on one VPS.

**Read `docs/BACKLOG.md` for outstanding work and `docs/ARCHITECTURE.md` for how the pieces
fit.** This file is conventions and landmines only.

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

There is **no migrations directory**. Schema ships via `prisma db push`, which means:

- `npm run build` is plain `next build` and applies nothing. Adding a field and deploying
  without a push ships code that queries a column prod doesn't have → runtime 500s, not
  build errors.
- `db push` **halts** on anything it considers data loss — dropping a non-empty table, *or
  adding a `@unique` column*. Reproduce against the local DB first to find out whether your
  change needs `--accept-data-loss`, rather than discovering it mid-deploy.
- Always `pg_dump` before a destructive push. Daily backups run at 3am via
  `/usr/local/bin/backup-outlanderos.sh` (server-side, 30-day retention).

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
export DATABASE_URL="postgresql://outlanderos:test123@127.0.0.1:5432/outlanderos"
npx prisma db push [--accept-data-loss if needed] && npx prisma generate
export NODE_OPTIONS="--max-old-space-size=3584" && npm run build && pm2 restart outlanderos
git log --oneline -1                # confirm this matches what you pushed
```

**Never pipe `git pull` into `tail` inside an `&&` chain.** A pipeline's exit status is
`tail`'s, so an aborted pull is masked: the chain rebuilds and restarts the *old* code and
prints `DONE`. This has already caused a deploy that silently shipped nothing. Always check
`git log --oneline -1` on the server afterwards.

Assets under `public/` need only a `git pull` — prod runs plain `next start`. Pulls abort on
untracked-file collisions on the server.

`NEXTAUTH_SECRET` lives in `.env.local` on prod (not `.env`, not the process env). To test
prod APIs, mint a JWT with it and pass it as the `auth_token` cookie.
