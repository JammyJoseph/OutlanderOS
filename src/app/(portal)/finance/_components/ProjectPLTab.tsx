'use client'

import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { StatusBadge, BudgetBar, ErrorBox, TabSkeleton, EmptyState } from './FinanceBits'
import {
  useFinanceFetch,
  fmtGBP,
  fmtPct,
  fmtDate,
  marginPct,
  BUDGET_STATUS_STYLES,
  type CampaignBudgetsResponse,
  type CostEntriesResponse,
  type CostEntry,
} from './finance-utils'

const STATUS_OPTIONS = ['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'RECONCILED']

export default function ProjectPLTab() {
  const budgetsRes = useFinanceFetch<CampaignBudgetsResponse>('/api/finance/campaign-budgets')
  const costsRes = useFinanceFetch<CostEntriesResponse>('/api/finance/cost-entries')

  const [client, setClient] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const budgets = budgetsRes.data?.budgets ?? []
  const entries = costsRes.data?.entries ?? []

  // Aggregate logged costs by campaign budget.
  const actualByBudget = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entries) {
      if (!e.campaignBudgetId) continue
      m.set(e.campaignBudgetId, (m.get(e.campaignBudgetId) ?? 0) + e.amount)
    }
    return m
  }, [entries])

  const entriesByBudget = useMemo(() => {
    const m = new Map<string, CostEntry[]>()
    for (const e of entries) {
      if (!e.campaignBudgetId) continue
      const arr = m.get(e.campaignBudgetId) ?? []
      arr.push(e)
      m.set(e.campaignBudgetId, arr)
    }
    return m
  }, [entries])

  const clients = useMemo(() => Array.from(new Set(budgets.map((b) => b.clientName))).sort(), [budgets])

  const filtered = budgets.filter((b) => {
    if (client !== 'ALL' && b.clientName !== client) return false
    if (status !== 'ALL' && b.status !== status) return false
    if (from && new Date(b.createdAt) < new Date(from)) return false
    if (to && new Date(b.createdAt) > new Date(`${to}T23:59:59`)) return false
    return true
  })

  if (budgetsRes.loading || costsRes.loading) return <TabSkeleton />
  if (budgetsRes.error || budgetsRes.data?.error) {
    return <ErrorBox message={`Failed to load campaign budgets: ${budgetsRes.error ?? budgetsRes.data?.error}`} />
  }

  const totals = filtered.reduce(
    (acc, b) => {
      const actual = actualByBudget.get(b.id) ?? 0
      acc.total += b.totalBudget
      acc.production += b.productionBudget
      acc.media += b.mediaBudget
      acc.actual += actual
      acc.profit += b.totalBudget - actual
      return acc
    },
    { total: 0, production: 0, media: 0, actual: 0, profit: 0 },
  )

  const selectCls = 'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-[#D4A853] focus:outline-none'

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={client} onChange={(e) => setClient(e.target.value)} className={selectCls}>
          <option value="ALL">All clients</option>
          {clients.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} aria-label="From date" />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} aria-label="To date" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No campaign budgets match these filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-6 px-2 py-2.5" />
                {['Client', 'Campaign', 'Total', 'Production', 'Media', 'Actual', 'Profit', 'Margin', 'Status'].map((h) => (
                  <th
                    key={h}
                    className={`px-3 py-2.5 font-medium text-gray-500 ${['Total', 'Production', 'Media', 'Actual', 'Profit', 'Margin'].includes(h) ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.map((b) => {
                const actual = actualByBudget.get(b.id) ?? 0
                const profit = b.totalBudget - actual
                const margin = marginPct(profit, b.totalBudget)
                const over = actual > b.totalBudget && b.totalBudget > 0
                const isOpen = expanded === b.id
                const rows = entriesByBudget.get(b.id) ?? []
                return (
                  <Fragment key={b.id}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : b.id)}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                    >
                      <td className="px-2 py-2.5 text-gray-400">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2.5 font-medium text-gray-900">{b.clientName}</td>
                      <td className="max-w-[160px] truncate px-3 py-2.5 text-gray-600">{b.campaignName}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtGBP(b.totalBudget)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-500">{fmtGBP(b.productionBudget)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-500">{fmtGBP(b.mediaBudget)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono ${over ? 'text-red-500' : 'text-gray-800'}`}>{fmtGBP(actual)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtGBP(profit)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono ${(margin ?? 0) >= 0 ? 'text-gray-700' : 'text-red-500'}`}>{fmtPct(margin)}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={b.status} map={BUDGET_STATUS_STYLES} /></td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50/60">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="mb-2 flex items-center gap-4">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Budget vs Spend</span>
                            <div className="flex-1 max-w-[200px]"><BudgetBar spent={actual} budget={b.totalBudget} /></div>
                          </div>
                          {rows.length === 0 ? (
                            <p className="text-[11px] text-gray-400">No cost entries logged for this project yet.</p>
                          ) : (
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="text-gray-400">
                                  <th className="py-1 text-left font-medium">Date</th>
                                  <th className="py-1 text-left font-medium">Category</th>
                                  <th className="py-1 text-left font-medium">Description</th>
                                  <th className="py-1 text-left font-medium">Vendor</th>
                                  <th className="py-1 text-right font-medium">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((r) => (
                                  <tr key={r.id} className="border-t border-gray-200/70">
                                    <td className="py-1 text-gray-500">{fmtDate(r.date)}</td>
                                    <td className="py-1 text-gray-600 capitalize">{r.category}</td>
                                    <td className="py-1 text-gray-700">{r.description}</td>
                                    <td className="py-1 text-gray-500">{r.vendor ?? '—'}</td>
                                    <td className="py-1 text-right font-mono text-gray-800">{fmtGBP(r.amount, { decimals: true })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td />
                <td className="px-3 py-2.5 font-semibold text-gray-500" colSpan={2}>Totals ({filtered.length})</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-800">{fmtGBP(totals.total)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-500">{fmtGBP(totals.production)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-500">{fmtGBP(totals.media)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtGBP(totals.actual)}</td>
                <td className={`px-3 py-2.5 text-right font-mono font-bold ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtGBP(totals.profit)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
