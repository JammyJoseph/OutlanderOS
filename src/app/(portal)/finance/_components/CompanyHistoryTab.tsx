'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import KPICard from './KPICard'
import { ErrorBox, EmptyState, XeroDisconnectedBanner } from './FinanceBits'
import {
  useFinanceFetch,
  fmtGBP,
  fmtPct,
  marginPct,
  type OverviewResponse,
  type InvoicesResponse,
  type CampaignBudgetsResponse,
} from './finance-utils'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

const PERIODS: { label: string; value: string }[] = [
  { label: 'Full Year', value: 'FY' },
  { label: 'Q1 (Jan–Mar)', value: 'Q1' },
  { label: 'Q2 (Apr–Jun)', value: 'Q2' },
  { label: 'Q3 (Jul–Sep)', value: 'Q3' },
  { label: 'Q4 (Oct–Dec)', value: 'Q4' },
]

function periodRange(year: number, period: string): { from: string; to: string } {
  const map: Record<string, [number, number]> = { FY: [1, 12], Q1: [1, 3], Q2: [4, 6], Q3: [7, 9], Q4: [10, 12] }
  const [startM, endM] = map[period] ?? [1, 12]
  const from = `${year}-${String(startM).padStart(2, '0')}-01`
  const last = new Date(year, endM, 0)
  const to = `${year}-${String(endM).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  return { from, to }
}

export default function CompanyHistoryTab() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [period, setPeriod] = useState('FY')

  const { from, to } = periodRange(year, period)
  const periodRes = useFinanceFetch<OverviewResponse>(`/api/finance/overview?from=${from}&to=${to}`)
  const thisYear = useFinanceFetch<OverviewResponse>(`/api/finance/overview?from=${CURRENT_YEAR}-01-01&to=${CURRENT_YEAR}-12-31`)
  const lastYear = useFinanceFetch<OverviewResponse>(`/api/finance/overview?from=${CURRENT_YEAR - 1}-01-01&to=${CURRENT_YEAR - 1}-12-31`)
  const invoicesRes = useFinanceFetch<InvoicesResponse>('/api/finance/invoices')
  const budgetsRes = useFinanceFetch<CampaignBudgetsResponse>('/api/finance/campaign-budgets')

  const topClients = useMemo(() => {
    const m = new Map<string, number>()
    for (const inv of invoicesRes.data?.invoices ?? []) {
      if (!inv.contact) continue
      m.set(inv.contact, (m.get(inv.contact) ?? 0) + inv.amount)
    }
    return Array.from(m.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [invoicesRes.data])

  const typeBreakdown = useMemo(() => {
    const acc = { production: 0, media: 0, internal: 0, other: 0 }
    for (const b of budgetsRes.data?.budgets ?? []) {
      acc.production += b.productionBudget
      acc.media += b.mediaBudget
      acc.internal += b.internalBudget
      acc.other += b.otherBudget
    }
    return acc
  }, [budgetsRes.data])

  const connected = periodRes.data?.xeroConnected ?? thisYear.data?.xeroConnected

  if (periodRes.error) return <ErrorBox message={`Failed to load history: ${periodRes.error}`} />

  const pl = periodRes.data?.profitAndLoss
  const margin = pl ? marginPct(pl.profit, pl.revenue) : null

  const thisRev = thisYear.data?.profitAndLoss?.revenue ?? 0
  const lastRev = lastYear.data?.profitAndLoss?.revenue ?? 0
  const yoy = lastRev > 0 ? ((thisRev - lastRev) / lastRev) * 100 : null

  const typeTotal = typeBreakdown.production + typeBreakdown.media + typeBreakdown.internal + typeBreakdown.other
  const typeRows = [
    { label: 'Production', value: typeBreakdown.production, color: 'bg-[#D4A853]' },
    { label: 'Media', value: typeBreakdown.media, color: 'bg-blue-500' },
    { label: 'Internal / Editorial', value: typeBreakdown.internal, color: 'bg-emerald-500' },
    { label: 'Other', value: typeBreakdown.other, color: 'bg-gray-400' },
  ]

  const selectCls = 'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-[#D4A853] focus:outline-none'

  return (
    <div className="space-y-5">
      {!connected && !periodRes.loading && (
        <XeroDisconnectedBanner message="Connect Xero for full company history — P&L figures below require live accounting data." />
      )}

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectCls}>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className={selectCls}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Period P&L */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Revenue" value={connected ? fmtGBP(pl?.revenue) : '—'} accent="positive" loading={periodRes.loading} />
        <KPICard label="Expenses" value={connected ? fmtGBP(pl?.expenses) : '—'} accent="negative" loading={periodRes.loading} />
        <KPICard label="Profit" value={connected ? fmtGBP(pl?.profit) : '—'} accent="amber" loading={periodRes.loading} />
        <KPICard label="Margin" value={connected ? fmtPct(margin) : '—'} accent={(margin ?? 0) >= 0 ? 'positive' : 'negative'} loading={periodRes.loading} />
      </div>

      {/* YoY growth */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Year-over-Year Revenue Growth</p>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-[11px] text-gray-400">{CURRENT_YEAR - 1}</p>
            <p className="font-mono text-xl font-bold text-gray-500">{connected ? fmtGBP(lastRev) : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">{CURRENT_YEAR}</p>
            <p className="font-mono text-xl font-bold text-gray-900">{connected ? fmtGBP(thisRev) : '—'}</p>
          </div>
          {connected && yoy !== null && (
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${yoy >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {yoy >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {yoy >= 0 ? '+' : ''}{yoy.toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top clients */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Top Clients by Spend</p>
          {!connected ? (
            <p className="text-xs text-gray-400">Connect Xero to rank clients by invoiced spend.</p>
          ) : topClients.length === 0 ? (
            <EmptyState message="No client invoices found." />
          ) : (
            <ul className="space-y-2">
              {topClients.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-4 text-gray-300">{i + 1}</span>
                    <span className="truncate text-gray-700">{c.name}</span>
                  </span>
                  <span className="ml-3 shrink-0 font-mono font-semibold text-gray-900">{fmtGBP(c.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Project type breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Budget Allocation by Type</p>
          {typeTotal === 0 ? (
            <p className="text-xs text-gray-400">No campaign budgets recorded yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                {typeRows.map((r) => (
                  <div key={r.label} className={r.color} style={{ width: `${(r.value / typeTotal) * 100}%` }} />
                ))}
              </div>
              <ul className="space-y-1.5">
                {typeRows.map((r) => (
                  <li key={r.label} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-sm ${r.color}`} />
                      <span className="text-gray-600">{r.label}</span>
                    </span>
                    <span className="font-mono text-gray-800">
                      {fmtGBP(r.value)} <span className="text-gray-400">({Math.round((r.value / typeTotal) * 100)}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
