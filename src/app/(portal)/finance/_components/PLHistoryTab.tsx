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
  type ReceivablesResponse,
  type ProjectsResponse,
} from './finance-utils'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type Granularity = 'monthly' | 'quarterly' | 'yearly'

function periodOptions(granularity: Granularity): { label: string; value: string }[] {
  if (granularity === 'monthly') return MONTHS.map((m, i) => ({ label: m, value: `M${i + 1}` }))
  if (granularity === 'quarterly')
    return [
      { label: 'Q1 (Jan–Mar)', value: 'Q1' },
      { label: 'Q2 (Apr–Jun)', value: 'Q2' },
      { label: 'Q3 (Jul–Sep)', value: 'Q3' },
      { label: 'Q4 (Oct–Dec)', value: 'Q4' },
    ]
  return [{ label: 'Full Year', value: 'FY' }]
}

function periodRange(year: number, period: string): { from: string; to: string } {
  let startM = 1
  let endM = 12
  if (period.startsWith('M')) {
    startM = endM = Number(period.slice(1))
  } else if (period.startsWith('Q')) {
    const q = Number(period.slice(1))
    startM = (q - 1) * 3 + 1
    endM = startM + 2
  }
  const from = `${year}-${String(startM).padStart(2, '0')}-01`
  const last = new Date(year, endM, 0)
  const to = `${year}-${String(endM).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  return { from, to }
}

export default function PLHistoryTab() {
  const [granularity, setGranularity] = useState<Granularity>('yearly')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [period, setPeriod] = useState('FY')

  const options = periodOptions(granularity)
  const effectivePeriod = options.some((o) => o.value === period) ? period : options[0].value
  const { from, to } = periodRange(year, effectivePeriod)

  const periodRes = useFinanceFetch<OverviewResponse>(`/api/finance/overview?from=${from}&to=${to}`)
  const thisYear = useFinanceFetch<OverviewResponse>(`/api/finance/overview?from=${CURRENT_YEAR}-01-01&to=${CURRENT_YEAR}-12-31`)
  const lastYear = useFinanceFetch<OverviewResponse>(`/api/finance/overview?from=${CURRENT_YEAR - 1}-01-01&to=${CURRENT_YEAR - 1}-12-31`)
  const receivablesRes = useFinanceFetch<ReceivablesResponse>('/api/finance/receivables')
  const projectsRes = useFinanceFetch<ProjectsResponse>('/api/finance/projects')

  // Revenue by client from Xero invoices.
  const revenueByClient = useMemo(() => {
    const m = new Map<string, { invoiced: number; paid: number }>()
    for (const inv of receivablesRes.data?.invoices ?? []) {
      if (!inv.contact) continue
      const row = m.get(inv.contact) ?? { invoiced: 0, paid: 0 }
      row.invoiced += inv.amount
      row.paid += inv.amountPaid
      m.set(inv.contact, row)
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.invoiced - a.invoiced)
      .slice(0, 10)
  }, [receivablesRes.data])

  // Per-project margin: budget (what the client pays) vs costs logged.
  const projectMargins = useMemo(() => {
    return (projectsRes.data?.projects ?? [])
      .filter((p) => p.totalBudget > 0)
      .map((p) => ({
        id: p.id,
        name: p.campaignName,
        client: p.clientName,
        budget: p.totalBudget,
        costs: p.totalCosts,
        margin: marginPct(p.totalBudget - p.totalCosts, p.totalBudget),
      }))
      .sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0))
  }, [projectsRes.data])

  const connected = periodRes.data?.xeroConnected ?? thisYear.data?.xeroConnected

  if (periodRes.error) return <ErrorBox message={`Failed to load P&L: ${periodRes.error}`} />

  const pl = periodRes.data?.profitAndLoss
  const margin = pl ? marginPct(pl.profit, pl.revenue) : null

  const thisPL = thisYear.data?.profitAndLoss
  const lastPL = lastYear.data?.profitAndLoss
  const yoy = lastPL && lastPL.revenue > 0 && thisPL ? ((thisPL.revenue - lastPL.revenue) / lastPL.revenue) * 100 : null

  const selectCls = 'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-[#ffd700] focus:outline-none'

  return (
    <div className="space-y-5">
      {!connected && !periodRes.loading && (
        <XeroDisconnectedBanner message="Connect Xero for the full P&L — figures below require live accounting data." />
      )}

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {(['monthly', 'quarterly', 'yearly'] as const).map((g) => (
            <button
              key={g}
              onClick={() => {
                setGranularity(g)
                setPeriod(periodOptions(g)[0].value)
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${granularity === g ? 'bg-[#ffd700] text-gray-900' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {g}
            </button>
          ))}
        </div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectCls}>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {granularity !== 'yearly' && (
          <select value={effectivePeriod} onChange={(e) => setPeriod(e.target.value)} className={selectCls}>
            {options.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* P&L for the selected period */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Revenue" value={connected ? fmtGBP(pl?.revenue) : '—'} accent="positive" loading={periodRes.loading} />
        <KPICard label="Expenses" value={connected ? fmtGBP(pl?.expenses) : '—'} accent="negative" loading={periodRes.loading} />
        <KPICard label="Profit" value={connected ? fmtGBP(pl?.profit) : '—'} accent="amber" loading={periodRes.loading} />
        <KPICard label="Margin" value={connected ? fmtPct(margin) : '—'} accent={(margin ?? 0) >= 0 ? 'positive' : 'negative'} loading={periodRes.loading} />
      </div>

      {/* Year-over-year comparison */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Year-over-Year</p>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-[11px] text-gray-400">{CURRENT_YEAR - 1} revenue</p>
            <p className="font-mono text-xl font-bold text-gray-500">{connected ? fmtGBP(lastPL?.revenue) : '—'}</p>
            <p className="text-[10px] text-gray-400">profit {connected ? fmtGBP(lastPL?.profit) : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">{CURRENT_YEAR} revenue</p>
            <p className="font-mono text-xl font-bold text-gray-900">{connected ? fmtGBP(thisPL?.revenue) : '—'}</p>
            <p className="text-[10px] text-gray-400">profit {connected ? fmtGBP(thisPL?.profit) : '—'}</p>
          </div>
          {connected && yoy !== null && (
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${yoy >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {yoy >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {yoy >= 0 ? '+' : ''}{yoy.toFixed(1)}% YoY
            </div>
          )}
          {connected && yoy === null && !lastYear.loading && (
            <p className="text-[11px] text-gray-400">No {CURRENT_YEAR - 1} revenue in Xero for comparison.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue by client */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Revenue by Client (Xero)</p>
          {!connected ? (
            <p className="text-xs text-gray-400">Connect Xero to rank clients by invoiced revenue.</p>
          ) : revenueByClient.length === 0 ? (
            <EmptyState message="No client invoices found." />
          ) : (
            <ul className="space-y-2">
              {revenueByClient.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-gray-300">{i + 1}</span>
                    <span className="truncate text-gray-700">{c.name}</span>
                  </span>
                  <span className="ml-3 shrink-0 font-mono">
                    <span className="font-semibold text-gray-900">{fmtGBP(c.invoiced)}</span>
                    <span className="ml-1.5 text-[10px] text-emerald-600">{fmtGBP(c.paid)} paid</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Project margin analysis */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Project Margin Analysis</p>
          {projectMargins.length === 0 ? (
            <p className="text-xs text-gray-400">No projects with budgets yet — margins appear once budgets and costs are logged.</p>
          ) : (
            <ul className="space-y-2">
              {projectMargins.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-800">{p.name}</p>
                    <p className="truncate text-[10px] text-gray-400">{p.client} · {fmtGBP(p.budget)} budget · {fmtGBP(p.costs)} costs</p>
                  </div>
                  <span className={`shrink-0 font-mono font-semibold ${(p.margin ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmtPct(p.margin)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
