'use client'

// The money position, with every figure saying where it came from.
//
// The design problem this solves: the dashboard used to show a Xero bank
// balance next to a budget total typed in last month, in identical type, with
// nothing to tell them apart. Both are useful; confusing them is not. A reader
// who cannot tell an invoiced fact from a pipeline hope will either trust all of
// it or none of it, and both are wrong.
//
// So each card carries a layer mark and names its source underneath. Three
// layers, consistently coloured wherever they appear:
//
//   ACTUAL     it happened — Xero saw it
//   COMMITTED  agreed, not yet paid
//   FORECAST   expected, will change
//
// The staleness line sits above the numbers rather than below them, because a
// figure four hours old is fine and a figure four hours old that you believed
// was live is a mistake. And when the Xero mirror is empty, the ACTUAL cards
// say "not synced" instead of "£0" — a zero that means "we do not know" is the
// single most dangerous thing a finance screen can print.

import { AlertTriangle, CircleDot, Clock } from 'lucide-react'
import { fmtGBP, useFinanceFetch } from './finance-utils'

type Layer = 'ACTUAL' | 'COMMITTED' | 'FORECAST'

interface Figure {
  value: number
  layer: Layer
  source: string
  asOf: string | null
  count?: number
  note?: string
}

interface Position {
  cash: Figure
  receivableOutstanding: Figure
  receivableOverdue: Figure
  payableOutstanding: Figure
  payableOverdue: Figure
  committedSpend: Figure
  forecastSpend: Figure
  forecastIncome: Figure
  uncodedSpend: Figure
  netPositionActual: Figure
  netPositionProjected: Figure
  xero: {
    connected: boolean
    organisation: string | null
    error: string | null
    freshAsOf: string | null
    lastRunStatus: string | null
    empty: boolean
  }
}

const LAYER: Record<Layer, { label: string; dot: string; text: string }> = {
  ACTUAL: { label: 'Actual', dot: '#2E5E44', text: 'text-[#2E5E44] dark:text-[#4E8F6C]' },
  COMMITTED: { label: 'Committed', dot: '#9C7C2E', text: 'text-[#9C7C2E] dark:text-[#C9A44A]' },
  FORECAST: { label: 'Forecast', dot: '#2F4B8F', text: 'text-[#2F4B8F] dark:text-[#7C97D6]' },
}

function ago(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? '' : 's'} ago`
}

function FigureCard({
  label,
  f,
  /** True when this figure's source has no data, so 0 means "unknown". */
  unknown,
  emphasis,
}: {
  label: string
  f: Figure
  unknown?: boolean
  emphasis?: boolean
}) {
  const layer = LAYER[f.layer]
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4">
      <p className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
        <span className="h-2 w-2 shrink-0" style={{ backgroundColor: layer.dot }} />
        <span className="truncate">{label}</span>
      </p>

      {unknown ? (
        <p className="font-mono text-2xl font-bold text-gray-300 dark:text-gray-600">—</p>
      ) : (
        <p
          className={`font-mono font-bold tabular-nums ${emphasis ? 'text-3xl' : 'text-2xl'} ${layer.text}`}
        >
          {fmtGBP(f.value)}
        </p>
      )}

      <p className="mt-1.5 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
        <span className="font-medium">{layer.label}</span>
        {' · '}
        {unknown ? 'not synced yet' : f.source}
        {f.count !== undefined && !unknown ? ` · ${f.count}` : ''}
      </p>
      {f.note && !unknown && (
        <p className="mt-1 text-[11px] leading-snug text-gray-400 dark:text-gray-500">{f.note}</p>
      )}
    </div>
  )
}

export default function PositionPanel() {
  const { data: p, loading, error } = useFinanceFetch<Position>('/api/finance/position')

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
    )
  }
  if (error || !p) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-gray-500">
        Could not load the finance position. {error}
      </div>
    )
  }

  // Every ACTUAL figure comes from the Xero mirror. If nothing has ever synced,
  // they are all unknown rather than zero.
  const unknown = p.xero.empty

  return (
    <div className="space-y-3">
      {/* Provenance banner — what is behind the ACTUAL numbers, and how old. */}
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-2.5 text-[12px] ${
          p.xero.connected && !unknown
            ? 'border-border bg-card text-gray-500 dark:text-gray-400'
            : 'border-[#e5c9a0] bg-[#fdf6ea] text-[#7a5a1e] dark:border-[#5a4520] dark:bg-[#2a2008] dark:text-[#C9A44A]'
        }`}
      >
        {p.xero.connected && !unknown ? (
          <>
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              Actuals from <strong>{p.xero.organisation ?? 'Xero'}</strong>, synced{' '}
              {ago(p.xero.freshAsOf)}
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>Xero has never synced</strong>, so nothing below is known to have happened.
              Forecast and committed figures come from OutlanderOS and are unaffected.
            </span>
            {p.xero.error && (
              <span className="basis-full text-[11px] opacity-80">{p.xero.error}</span>
            )}
          </>
        )}
      </div>

      {/* What actually happened. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FigureCard label="Cash in the bank" f={p.cash} unknown={unknown} emphasis />
        <FigureCard label="Owed to us" f={p.receivableOutstanding} unknown={unknown} />
        <FigureCard label="We owe" f={p.payableOutstanding} unknown={unknown} />
        <FigureCard label="Net position" f={p.netPositionActual} unknown={unknown} emphasis />
      </div>

      {/* Overdue, both directions — the only figures anyone acts on today. */}
      {!unknown && (p.receivableOverdue.value > 0 || p.payableOverdue.value > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FigureCard label="Overdue to us" f={p.receivableOverdue} />
          <FigureCard label="Overdue from us" f={p.payableOverdue} />
        </div>
      )}

      {/* What is expected. Always available — it is our own data. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FigureCard label="Income forecast" f={p.forecastIncome} />
        <FigureCard label="Committed spend" f={p.committedSpend} />
        <FigureCard label="Budget remaining" f={p.forecastSpend} />
        <FigureCard label="Projected net" f={p.netPositionProjected} />
      </div>

      {/* The accuracy signal. Only shown when there is something to fix, because
          a permanent "£0 unattributed" badge is noise that trains people to
          ignore the place a real number will one day appear. */}
      {p.uncodedSpend.value > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[#e5c9a0] bg-[#fdf6ea] px-4 py-3 text-[12px] text-[#7a5a1e] dark:border-[#5a4520] dark:bg-[#2a2008] dark:text-[#C9A44A]">
          <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>{fmtGBP(p.uncodedSpend.value)}</strong> of spend across{' '}
            {p.uncodedSpend.count} line{p.uncodedSpend.count === 1 ? '' : 's'} is attributed to no
            production, deal or issue. It is counted in totals but appears in no project, so every
            project view is understated by this much until it is coded.
          </span>
        </div>
      )}
    </div>
  )
}
