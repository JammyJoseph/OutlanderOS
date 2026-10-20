'use client'

// "Where are you starting?" — the page after you log in, and "All workspaces"
// in the switcher. One grey card per workspace with a live line under it; the
// one you used last is light blue.
//
// "Skip this screen" only applies straight after logging in (?from=login), so
// "All workspaces" always brings you back here.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Lock, Shield } from 'lucide-react'
import { Suspense } from 'react'
import { getJson } from '@/lib/session-fetch'
import { readPref, usePref } from '@/lib/use-pref'
import { useUser } from '@/components/user-context'
import { Logo } from '@/components/shell/Logo'
import { AccountMenu, LAST_WORKSPACE_KEY, SearchLauncher } from '@/components/shell/AppShell'
import { visibleWorkspaces, WORKSPACES, type WorkspaceKey } from '@/lib/workspaces'

const SKIP_KEY = 'os:skip-hub'

type Lines = Partial<Record<WorkspaceKey, string>>

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/London' }).format(now))
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const count = (v: unknown): number | undefined => {
  if (Array.isArray(v)) return v.length
  // The list APIs answer in a few shapes: a bare array, {total}, or the list
  // under a named key.
  const o = v as Record<string, unknown> | null
  if (typeof o?.total === 'number') return o.total
  for (const k of ['data', 'productions', 'issues', 'tasks', 'contacts']) {
    if (Array.isArray(o?.[k])) return (o[k] as unknown[]).length
  }
  return undefined
}
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`

function Hub() {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useUser()
  const isAdmin = user?.role === 'ADMIN'
  const [lines, setLines] = useState<Lines>({})
  const [lastPref] = usePref(LAST_WORKSPACE_KEY)
  const [skipPref, setSkipPref] = usePref(SKIP_KEY)
  const last = lastPref as WorkspaceKey | null
  const skip = skipPref === '1'

  // Honour "skip this screen" straight after logging in.
  useEffect(() => {
    if (params.get('from') !== 'login' || readPref(SKIP_KEY) !== '1') return
    const target = WORKSPACES.find((w) => w.key === readPref(LAST_WORKSPACE_KEY))
    router.replace(target?.href ?? '/me')
  }, [params, router])

  useEffect(() => {
    let live = true
    ;(async () => {
      const [tasks, deals, productions, issues, contacts, dash] = await Promise.allSettled([
        getJson<unknown>('/api/tasks'),
        getJson<unknown>('/api/campaigns'),
        getJson<unknown>('/api/productions'),
        getJson<unknown>('/api/print-issues'),
        getJson<unknown>('/api/contacts?radar=false'),
        getJson<{ billingTracker?: { bookedRevenue?: string } }>('/api/dashboard'),
      ])
      const next: Lines = {}
      const val = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : undefined)
      const t = val(tasks) as { tasks?: { status?: string; dueDate?: string | null }[] } | undefined
      if (Array.isArray(t?.tasks)) {
        const weekOut = Date.now() + 7 * 86400000
        const due = t.tasks.filter((x) => x.status !== 'DONE' && x.dueDate && new Date(x.dueDate).getTime() <= weekOut).length
        next.me = due ? `${plural(due, 'task')} due this week` : 'Nothing due this week'
      }
      const d = count(val(deals))
      if (d !== undefined) next.commercial = plural(d, 'active deal')
      const p = count(val(productions))
      if (p !== undefined) next.production = plural(p, 'production')
      const i = count(val(issues))
      if (i !== undefined) next.print = plural(i, 'issue')
      const c = count(val(contacts))
      if (c !== undefined) next.directory = plural(c, 'contact')
      const booked = (val(dash) as { billingTracker?: { bookedRevenue?: string } } | undefined)?.billingTracker?.bookedRevenue
      if (booked && booked !== '—') next.finance = `${booked} booked`
      next.admin = 'Team, system and settings'
      if (live) setLines(next)
    })()
    return () => {
      live = false
    }
  }, [])

  const spaces = useMemo(() => visibleWorkspaces(isAdmin).filter((w) => w.key !== 'admin'), [isAdmin])
  const first = user?.name?.split(/\s+/)[0]
  const now = new Date()
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' }).format(now)

  const toggleSkip = (on: boolean) => setSkipPref(on ? '1' : null)

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-12">
        <Logo className="h-[22px]" href={null} />
        <div className="flex items-center gap-3">
          <SearchLauncher />
          <AccountMenu />
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-5 pb-20 pt-6 sm:px-6 sm:pt-12">
        <div className="mb-10 flex flex-col gap-2">
          <p className="text-base text-muted-foreground">{date}</p>
          <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.015em] sm:text-[40px]">
            {greeting(now)}
            {first ? `, ${first}` : ''}. Where are you starting?
          </h1>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
          {spaces.map((w) => {
            const Icon = w.icon
            const isLast = w.key === last
            return (
              <Link
                key={w.key}
                href={w.href}
                className={`group flex min-h-[220px] flex-col gap-5 rounded-2xl p-7 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                  isLast ? 'bg-accent hover:brightness-[0.98]' : 'bg-surface hover:bg-surface-2'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="flex size-[52px] items-center justify-center rounded-full bg-background">
                    <Icon className="size-5 text-ink-2" strokeWidth={1.75} aria-hidden />
                  </span>
                  {isLast ? (
                    <span className="inline-flex h-[26px] items-center rounded-full bg-background px-2.5 text-xs font-semibold text-ink-2">Last used</span>
                  ) : w.adminOnly ? (
                    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-background px-2.5 text-xs font-semibold text-ink-2">
                      <Lock className="size-3.5" strokeWidth={1.75} aria-hidden /> Admin
                    </span>
                  ) : null}
                </div>
                <div className="mt-auto">
                  <div className="flex items-center gap-2.5 text-[21px] font-semibold">
                    {w.key !== 'me' && <span className="size-2 rounded-full" style={{ background: w.dot }} aria-hidden />}
                    {w.name}
                  </div>
                  <div className={`mt-1 ${isLast ? 'text-ink-2' : 'text-muted-foreground'}`}>{w.blurb}</div>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{lines[w.key] ?? ' '}</span>
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden />
                </div>
              </Link>
            )
          })}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink-2">
            <input type="checkbox" checked={skip} onChange={(e) => toggleSkip(e.target.checked)} className="size-5 accent-foreground" />
            Skip this screen and open my last workspace when I log in
          </label>
          {isAdmin && (
            <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold hover:text-brand">
              <Shield className="size-[18px]" strokeWidth={1.75} aria-hidden /> Admin settings
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}

export default function HubPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <Hub />
    </Suspense>
  )
}
