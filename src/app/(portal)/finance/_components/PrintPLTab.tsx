'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import KPICard from './KPICard'
import { ErrorBox, EmptyState } from './FinanceBits'
import { useFinanceFetch, fmtGBP } from './finance-utils'

interface PrintIssuePL {
  id: string
  issueNumber: number
  issueName: string
  totalPages: number
  revenue: number
  productionCost: number
  printCost: number
  margin: number
  revenuePerPage: number
  costPerPage: number
  paidFeatures: number
  atCostFeatures: number
  paidRevenue: number
  atCostSpend: number
}

interface PrintPLResponse {
  issues: PrintIssuePL[]
  totals: {
    revenue: number
    productionCost: number
    printCost: number
    margin: number
    paidFeatures: number
    atCostFeatures: number
  } | null
}

// Finance → Print P&L. Aggregates the per-issue Print Budgets: advertiser revenue
// vs at-cost editorial, and the magazine-wide P&L across every issue.
export default function PrintPLTab() {
  const { data, loading, error } = useFinanceFetch<PrintPLResponse>('/api/finance/print-pl')

  if (error) return <ErrorBox message={`Failed to load Print P&L: ${error}`} />

  const t = data?.totals
  const issues = data?.issues ?? []

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Magazine Revenue" value={fmtGBP(t?.revenue)} accent="positive" loading={loading} />
        <KPICard
          label="Total Costs"
          value={fmtGBP((t?.productionCost ?? 0) + (t?.printCost ?? 0))}
          accent="negative"
          loading={loading}
          sub={t ? `${fmtGBP(t.productionCost)} prod · ${fmtGBP(t.printCost)} print` : undefined}
        />
        <KPICard
          label="Net Margin"
          value={fmtGBP(t?.margin)}
          accent={(t?.margin ?? 0) >= 0 ? 'positive' : 'negative'}
          loading={loading}
        />
        <KPICard
          label="Paid / At-Cost"
          value={t ? `${t.paidFeatures} / ${t.atCostFeatures}` : '—'}
          accent="default"
          loading={loading}
          sub="features"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Per-Issue P&amp;L</p>
        </div>
        {issues.length === 0 && !loading ? (
          <div className="p-5">
            <EmptyState message="No magazine issues with budget data yet — link deals and productions in the Print Budget tab." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-2 font-semibold">Issue</th>
                  <th className="px-3 py-2 text-right font-semibold">Pages</th>
                  <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                  <th className="px-3 py-2 text-right font-semibold">Prod. Cost</th>
                  <th className="px-3 py-2 text-right font-semibold">Print Cost</th>
                  <th className="px-3 py-2 text-right font-semibold">Margin</th>
                  <th className="px-3 py-2 text-right font-semibold">Paid / At-Cost</th>
                  <th className="px-3 py-2 text-center font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {issues.map((iss) => (
                  <tr key={iss.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-2.5">
                      <span className="font-medium text-gray-900">
                        Issue {String(iss.issueNumber).padStart(2, '0')} — {iss.issueName}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">{iss.totalPages}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-600">
                      {fmtGBP(iss.revenue)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-700">{fmtGBP(iss.productionCost)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-700">{fmtGBP(iss.printCost)}</td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono font-semibold ${
                        iss.margin >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {fmtGBP(iss.margin)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">
                      {iss.paidFeatures} / {iss.atCostFeatures}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Link
                        href={`/print/flat-plan?issue=${iss.issueNumber}`}
                        className="inline-flex items-center gap-1 text-[11px] text-[#4d9fff] hover:underline"
                      >
                        Budget <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              {t && issues.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold text-gray-900">
                    <td className="px-5 py-3" colSpan={2}>
                      Total Magazine P&amp;L
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-emerald-600">{fmtGBP(t.revenue)}</td>
                    <td className="px-3 py-3 text-right font-mono">{fmtGBP(t.productionCost)}</td>
                    <td className="px-3 py-3 text-right font-mono">{fmtGBP(t.printCost)}</td>
                    <td
                      className={`px-3 py-3 text-right font-mono ${t.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      {fmtGBP(t.margin)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {t.paidFeatures} / {t.atCostFeatures}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400">
        Revenue is advertiser money in (from linked Commercial deals); at-cost features are editorial pages with no
        client revenue. Margin = revenue − production cost − print cost.
      </p>
    </div>
  )
}
