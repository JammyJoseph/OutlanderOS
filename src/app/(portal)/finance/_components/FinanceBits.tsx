'use client'

import { AlertCircle, Link2 } from 'lucide-react'
import { badgeClass } from './finance-utils'

// `status` is the displayed label; pass `rawKey` when the styling key differs
// from the label (e.g. status "UNDER_REVIEW" displayed as "UNDER REVIEW").
export function StatusBadge({ status, map, rawKey }: { status?: string; map: Record<string, string>; rawKey?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass(map, rawKey ?? status)}`}>
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
  const color = connected ? 'bg-emerald-500' : needsRefresh ? 'bg-amber-400' : 'bg-red-500'
  const label = connected
    ? organisation
      ? `Xero connected · ${organisation}`
      : 'Xero connected'
    : needsRefresh
      ? 'Xero token needs refresh'
      : 'Xero disconnected'
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}

// Full-width fallback shown where Xero data would appear.
export function XeroDisconnectedBanner({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {message ?? 'Xero is disconnected — live accounting data is unavailable.'}
      </div>
      <a
        href="/api/xero/connect"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#ffd700] px-3 py-1.5 text-[11px] font-semibold text-gray-900 transition-colors hover:bg-[#ffd700]"
      >
        <Link2 className="h-3.5 w-3.5" />
        Connect Xero
      </a>
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-12 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  )
}

export function TabSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />
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
      <div className="h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={`text-[10px] font-mono ${over ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
        {budget > 0 ? `${Math.round(ratio * 100)}%` : '—'}
      </span>
    </div>
  )
}
