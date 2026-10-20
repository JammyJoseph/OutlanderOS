'use client'

import { AlertCircle, Link2 } from 'lucide-react'
import { badgeClass } from './finance-utils'

// `status` is the displayed label; pass `rawKey` when the styling key differs
// from the label (e.g. status "UNDER_REVIEW" displayed as "UNDER REVIEW").
export function StatusBadge({ status, map, rawKey }: { status?: string; map: Record<string, string>; rawKey?: string }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${badgeClass(map, rawKey ?? status)}`}>
      {status ?? '—'}
    </span>
  )
}

// Connection indicator: green (connected), amber (token refresh needed), red (disconnected).
export function XeroStatusDot({
  connected,
  error,
  organisation,
}: {
  connected?: boolean
  error?: string | null
  organisation?: string | null
}) {
  const needsRefresh = !!error && /token|refresh|expired|unauthor/i.test(error)
  const color = connected ? 'bg-ok' : needsRefresh ? 'bg-warn' : 'bg-bad'
  const label = connected
    ? organisation
      ? `Xero connected · ${organisation}`
      : 'Xero connected'
    : needsRefresh
      ? 'Xero token needs refresh'
      : 'Xero disconnected'
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface px-2.5 text-xs font-semibold text-ink-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}

// Full-width fallback shown where Xero data would appear.
export function XeroDisconnectedBanner({ message }: { message?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warn-bg px-5 py-3.5">
      <div className="flex items-center gap-2 text-[15px] text-warn">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {message ?? 'Xero is disconnected — live accounting data is unavailable.'}
      </div>
      <a
        href="/api/xero/connect"
        className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-background px-4 text-sm font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--field)] transition-colors hover:bg-surface"
      >
        <Link2 className="h-3.5 w-3.5" />
        Connect Xero
      </a>
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-center gap-2 rounded-2xl bg-bad-bg px-5 py-3.5 text-[15px] text-bad">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-surface px-6 py-12 text-center">
      <p className="text-[15px] text-muted-foreground">{message}</p>
    </div>
  )
}

export function TabSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[120px] animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-surface" />
    </div>
  )
}

// Visual spent-vs-budget bar. Green under budget, red over.
export function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const ratio = budget > 0 ? spent / budget : spent > 0 ? 1.5 : 0
  const over = ratio > 1
  const width = Math.min(ratio, 1) * 100
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${over ? 'bg-bad' : 'bg-foreground'}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={`text-xs tabular-nums ${over ? 'text-bad' : 'text-muted-foreground'}`}>
        {budget > 0 ? `${Math.round(ratio * 100)}%` : '—'}
      </span>
    </div>
  )
}
