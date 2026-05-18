'use client'

import { useEffect, useState } from 'react'
import { Link2, Clapperboard } from 'lucide-react'

interface DealBudget {
  id: string
  trelloCardId: string
  cardName: string
  client: string | null
  budget: number
  budgetLabel: string
  stage: string | null
  cardUrl: string | null
}

interface ProductionCost {
  id: string
  title: string
  client: string | null
  campaignBudget: number | null
  budgeted: number
  actual: number
}

function gbp(n: number): string {
  return n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
}

export default function CrossPortalPanel() {
  const [deals, setDeals] = useState<DealBudget[]>([])
  const [dealTotal, setDealTotal] = useState(0)
  const [productions, setProductions] = useState<ProductionCost[]>([])
  const [prodActual, setProdActual] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/finance/deal-budgets').then((r) => r.json()).catch(() => ({ deals: [], total: 0 })),
      fetch('/api/finance/production-costs').then((r) => r.json()).catch(() => ({ productions: [], totalActual: 0 })),
    ])
      .then(([db, pc]) => {
        if (cancelled) return
        setDeals(Array.isArray(db?.deals) ? db.deals : [])
        setDealTotal(db?.total ?? 0)
        setProductions(Array.isArray(pc?.productions) ? pc.productions : [])
        setProdActual(pc?.totalActual ?? 0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <div className="h-32 rounded-xl border border-gray-100 bg-gray-50 animate-pulse" />
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Trello pipeline deal budgets */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-[#D4A853]" />
            Pipeline Deal Budgets
          </h3>
          <span className="text-xs font-mono font-semibold text-gray-700">{gbp(dealTotal)}</span>
        </div>
        <p className="text-[11px] text-gray-400 mb-2">From the Trello commercial pipeline.</p>
        {deals.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No deal budgets synced yet.</p>
        ) : (
          <div className="divide-y divide-gray-50 max-h-72 overflow-auto">
            {deals.map((d) => (
              <a
                key={d.id}
                href={d.cardUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 py-2 hover:bg-gray-50 -mx-1 px-1 rounded"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-gray-800">{d.cardName}</span>
                  <span className="text-[10px] text-gray-400">
                    {d.client || '—'}
                    {d.stage ? ` · ${d.stage}` : ''}
                  </span>
                </span>
                <span className="text-xs font-mono font-semibold text-emerald-700 shrink-0">
                  {d.budgetLabel}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Production actual spend roll-up */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Clapperboard className="h-4 w-4 text-[#D4A853]" />
            Production Spend
          </h3>
          <span className="text-xs font-mono font-semibold text-gray-700">{gbp(prodActual)} actual</span>
        </div>
        <p className="text-[11px] text-gray-400 mb-2">Actual spend rolled up from production budgets.</p>
        {productions.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No production costs found.</p>
        ) : (
          <div className="divide-y divide-gray-50 max-h-72 overflow-auto">
            {productions.map((p) => (
              <a
                key={p.id}
                href={`/production/${p.id}`}
                className="flex items-center justify-between gap-2 py-2 hover:bg-gray-50 -mx-1 px-1 rounded"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-gray-800">{p.title}</span>
                  <span className="text-[10px] text-gray-400">{p.client || '—'}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-xs font-mono font-semibold text-gray-900">{gbp(p.actual)}</span>
                  <span className="text-[10px] text-gray-400">of {gbp(p.budgeted)} budgeted</span>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
