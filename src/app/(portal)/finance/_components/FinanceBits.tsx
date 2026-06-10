'use client'

import { AlertCircle, Link2 } from 'lucide-react'
import { badgeClass } from './finance-utils'

export function StatusBadge({ status, map }: { status?: string; map: Record<string, string> }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass(map, status)}`}>
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
    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}

// Full-width fallback shown where Xero data would appear.
export function XeroDisconnectedBanner({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-amber-800">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {message ?? 'Xero is disconnected — live accounting data is unavailable.'}
      </div>
      <a
        href="/api/xero/connect"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-1.5 text-[11px] font-semibold text-gray-900 transition-colors hover:bg-[#C49843]"
      >
        <Link2 className="h-3.5 w-3.5" />
        Connect Xero
      </a>
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

export function TabSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-xl border border-gray-200 bg-white" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-white" />
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
      <div className="h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={`text-[10px] font-mono ${over ? 'text-red-500' : 'text-gray-400'}`}>
        {budget > 0 ? `${Math.round(ratio * 100)}%` : '—'}
      </span>
    </div>
  )
}
