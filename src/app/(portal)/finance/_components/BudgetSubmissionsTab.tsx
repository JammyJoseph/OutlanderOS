'use client'

import { useState } from 'react'
import { StatusBadge, ErrorBox, TabSkeleton, EmptyState } from './FinanceBits'
import {
  useFinanceFetch,
  fmtGBP,
  fmtDate,
  BUDGET_STATUS_STYLES,
  type CampaignBudgetsResponse,
} from './finance-utils'

const FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'SUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
]

export default function BudgetSubmissionsTab() {
  const [filter, setFilter] = useState('SUBMITTED')
  const res = useFinanceFetch<CampaignBudgetsResponse>('/api/finance/campaign-budgets')
  const [busy, setBusy] = useState<string | null>(null)

  async function setStatus(id: string, status: string) {
    setBusy(id)
    try {
      await fetch(`/api/finance/campaign-budgets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      res.reload()
    } finally {
      setBusy(null)
    }
  }

  if (res.loading) return <TabSkeleton />
  if (res.error || res.data?.error) return <ErrorBox message={`Failed to load submissions: ${res.error ?? res.data?.error}`} />

  const all = res.data?.budgets ?? []
  const budgets = filter === 'ALL' ? all : all.filter((b) => b.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const count = f.value === 'ALL' ? all.length : all.filter((b) => b.status === f.value).length
          const active = filter === f.value
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-[#D4A853] text-gray-900' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {f.label} <span className={active ? 'text-gray-700' : 'text-gray-400'}>({count})</span>
            </button>
          )
        })}
      </div>

      {budgets.length === 0 ? (
        <EmptyState message="No budget submissions in this view." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Campaign', 'Client', 'Total Budget', 'Submitted By', 'Submitted', 'Status', 'Actions'].map((h) => (
                  <th key={h} className={`px-3 py-2.5 font-medium text-gray-500 ${h === 'Total Budget' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {budgets.map((b) => {
                const actionable = b.status === 'SUBMITTED' || b.status === 'DRAFT'
                return (
                  <tr key={b.id} className="transition-colors hover:bg-gray-50">
                    <td className="max-w-[180px] truncate px-3 py-2.5 font-medium text-gray-900">{b.campaignName}</td>
                    <td className="max-w-[140px] truncate px-3 py-2.5 text-gray-600">{b.clientName}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtGBP(b.totalBudget)}</td>
                    <td className="max-w-[120px] truncate px-3 py-2.5 text-gray-500">{b.submittedBy ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500">{fmtDate(b.updatedAt)}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={b.status} map={BUDGET_STATUS_STYLES} /></td>
                    <td className="px-3 py-2.5">
                      {actionable ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => setStatus(b.id, 'APPROVED')}
                            disabled={busy === b.id}
                            className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setStatus(b.id, 'REJECTED')}
                            disabled={busy === b.id}
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setStatus(b.id, 'DRAFT')}
                            disabled={busy === b.id}
                            className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                          >
                            Request Changes
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
