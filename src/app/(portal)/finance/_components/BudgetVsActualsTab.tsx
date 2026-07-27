'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import {
  useFinanceFetch,
  fmtGBP,
  fmtPct,
  displayStatus,
  badgeClass,
  OVERAGE_STATUS_STYLES,
  type ProjectsResponse,
  type ProjectSummary,
} from './finance-utils'
import { ErrorBox, TabSkeleton, EmptyState } from './FinanceBits'

// ===== Budget vs Actuals (portfolio view) =====
// Reads the same project financial summaries as Project Folders and rolls them
// up into a portfolio scorecard + a sortable budget-vs-actuals table. No data
// entry — every figure is derived from getProjectFinancialSummaries().
//
// Margin actual mirrors the detail endpoint's waterfall: production savings
// (budget − spend) flow straight into the margin, i.e.
//   marginActual = targetMargin + (budgetExVat − spent)
// so a project that comes in under budget realises *more* than its target.

type SortKey =
  | 'campaignName'
  | 'clientName'
  | 'budgetExVat'
  | 'spent'
  | 'variance'
  | 'variancePct'
  | 'targetMarginAmount'
  | 'marginActual'
  | 'status'
type SortDir = 'asc' | 'desc'

type BillingFilter = 'all' | 'PAID' | 'EDITORIAL'
type StatusFilter = 'all' | 'active' | 'completed'
type PeriodFilter = 'all' | '30' | '90' | 'year'

// A project reads as "completed" once its folder/production budget is settled or
// it has been archived; everything else is live work.
const COMPLETED_STATUS = /RECONCILED|FINAL|COMPLETE|CLOSED|ARCHIVED/i
function isCompleted(p: ProjectSummary): boolean {
  return p.archived || COMPLETED_STATUS.test(p.status)
}

// Derived per-row economics, computed once from the summary.
interface Row extends ProjectSummary {
  variance: number // budget − spent (positive = under budget)
  variancePct: number | null // variance as % of budget
  marginActual: number | null // realised margin (target + savings)
  marginRealisationPct: number | null // marginActual / target × 100
}

function toRow(p: ProjectSummary): Row {
  const variance = p.budgetExVat - p.spent
  const variancePct = p.budgetExVat > 0 ? (variance / p.budgetExVat) * 100 : null
  const marginActual = p.targetMarginAmount != null ? p.targetMarginAmount + variance : null
  const marginRealisationPct =
    p.targetMarginAmount != null && p.targetMarginAmount !== 0
      ? (marginActual! / p.targetMarginAmount) * 100
      : null
  return { ...p, variance, variancePct, marginActual, marginRealisationPct }
}

export default function BudgetVsActualsTab() {
  const router = useRouter()
  const { data, loading, error } = useFinanceFetch<ProjectsResponse>('/api/finance/projects')

  const [billing, setBilling] = useState<BillingFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [period, setPeriod] = useState<PeriodFilter>('all')
  // Cutoff is derived in the change handler (an event, where reading the clock is
  // allowed) rather than during render, keeping the render pure.
  const [periodCutoff, setPeriodCutoff] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('variance')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function changePeriod(p: PeriodFilter) {
    setPeriod(p)
    setPeriodCutoff(
      p === '30'
        ? Date.now() - 30 * 864e5
        : p === '90'
          ? Date.now() - 90 * 864e5
          : p === 'year'
            ? new Date(new Date().getFullYear(), 0, 1).getTime()
            : null,
    )
  }

  const rows = useMemo<Row[]>(() => {
    const all = (data?.projects ?? []).map(toRow)
    const cutoff = periodCutoff
    return all.filter((r) => {
      if (billing !== 'all' && r.billingType !== billing) return false
      if (status === 'active' && isCompleted(r)) return false
      if (status === 'completed' && !isCompleted(r)) return false
      if (cutoff != null) {
        const t = new Date(r.updatedAt).getTime()
        if (Number.isNaN(t) || t < cutoff) return false
      }
      return true
    })
  }, [data, billing, status, periodCutoff])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      // Nulls always sort last regardless of direction.
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
      return ((av as number) - (bv as number)) * dir
    })
  }, [rows, sortKey, sortDir])

  const totals = useMemo(() => {
    const budget = rows.reduce((s, r) => s + r.budgetExVat, 0)
    const spent = rows.reduce((s, r) => s + r.spent, 0)
    // Average margin realisation across projects that carry a target margin.
    const withMargin = rows.filter((r) => r.marginRealisationPct != null)
    const avgRealisation = withMargin.length
      ? withMargin.reduce((s, r) => s + (r.marginRealisationPct ?? 0), 0) / withMargin.length
      : null
    return {
      budget,
      spent,
      variance: budget - spent,
      avgRealisation,
      marginCount: withMargin.length,
      overageCount: rows.filter((r) => r.overageStatus === 'OVERAGE').length,
    }
  }, [rows])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Text columns feel natural ascending; money/variance descending by default.
      setSortDir(key === 'campaignName' || key === 'clientName' || key === 'status' ? 'asc' : 'desc')
    }
  }

  if (loading) return <TabSkeleton />
  if (error) return <ErrorBox message={`Couldn't load projects: ${error}`} />
  if (!data || data.projects.length === 0)
    return <EmptyState message="No projects with budgets yet." />

  return (
    <div className="space-y-5">
      {/* ===== Portfolio summary card ===== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Total budgeted" value={fmtGBP(totals.budget)} hint="exc. VAT" />
        <SummaryStat label="Total spent" value={fmtGBP(totals.spent)} hint={`${rows.length} projects`} />
        <SummaryStat
          label="Total variance"
          value={`${totals.variance < 0 ? '−' : ''}${fmtGBP(Math.abs(totals.variance))}`}
          hint={totals.variance >= 0 ? 'under budget' : 'over budget'}
          tone={totals.variance >= 0 ? 'good' : 'bad'}
        />
        <SummaryStat
          label="Avg margin realisation"
          value={fmtPct(totals.avgRealisation)}
          hint={
            totals.marginCount
              ? `${totals.marginCount} with target · vs 100%`
              : 'no margin targets set'
          }
          tone={
            totals.avgRealisation == null
              ? undefined
              : totals.avgRealisation >= 100
                ? 'good'
                : 'bad'
          }
        />
      </div>

      {/* ===== Filters ===== */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterGroup
          label="Billing"
          value={billing}
          onChange={(v) => setBilling(v as BillingFilter)}
          options={[
            { v: 'all', l: 'All' },
            { v: 'EDITORIAL', l: 'Editorial' },
            { v: 'PAID', l: 'Paid' },
          ]}
        />
        <FilterGroup
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={[
            { v: 'active', l: 'Active' },
            { v: 'completed', l: 'Completed' },
            { v: 'all', l: 'All' },
          ]}
        />
        <FilterGroup
          label="Period"
          value={period}
          onChange={(v) => changePeriod(v as PeriodFilter)}
          options={[
            { v: 'all', l: 'All time' },
            { v: '30', l: '30 days' },
            { v: '90', l: '90 days' },
            { v: 'year', l: 'This year' },
          ]}
        />
        {totals.overageCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {totals.overageCount} over budget
          </span>
        )}
      </div>

      {/* ===== Per-project table ===== */}
      {sorted.length === 0 ? (
        <EmptyState message="No projects match these filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                <Th label="Project" k="campaignName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Client" k="clientName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Budget" k="budgetExVat" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <Th label="Spent" k="spent" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <Th label="Variance" k="variance" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <Th label="Var %" k="variancePct" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <Th label="Margin tgt" k="targetMarginAmount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <Th label="Margin act" k="marginActual" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <Th label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const over = r.overageStatus === 'OVERAGE'
                const target = r.productionId
                  ? `/production/${r.productionId}`
                  : `/finance?tab=projects&project=${r.id}`
                return (
                  <tr
                    key={r.id}
                    onClick={() => router.push(target)}
                    className={`cursor-pointer border-b border-gray-100 text-gray-800 transition-colors dark:border-gray-800 dark:text-gray-200 ${
                      over
                        ? 'bg-red-50/60 hover:bg-red-50 dark:bg-red-900/20 dark:hover:bg-red-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span className="block max-w-[220px] truncate font-medium" title={r.campaignName}>
                        {r.campaignName}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">
                        {r.billingType === 'EDITORIAL' ? 'Editorial' : 'Paid'}
                        {r.source === 'production' ? ' · production' : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      <span className="block max-w-[160px] truncate" title={r.clientName}>
                        {r.clientName}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtGBP(r.budgetExVat)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtGBP(r.spent)}</td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums font-semibold ${
                        r.variance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {r.variance < 0 ? '−' : ''}
                      {fmtGBP(Math.abs(r.variance))}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums ${
                        r.variancePct == null
                          ? 'text-gray-400'
                          : r.variancePct < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {fmtPct(r.variancePct)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-500 dark:text-gray-400">
                      {r.targetMarginAmount != null ? fmtGBP(r.targetMarginAmount) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.marginActual == null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span
                          className={
                            r.marginRealisationPct != null && r.marginRealisationPct < 100
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                          title={
                            r.marginRealisationPct != null
                              ? `${fmtPct(r.marginRealisationPct)} of target`
                              : undefined
                          }
                        >
                          {fmtGBP(r.marginActual)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass(
                          OVERAGE_STATUS_STYLES,
                          r.overageStatus,
                        )}`}
                        title={displayStatus(r.status)}
                      >
                        {displayStatus(r.status)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 text-[12px] font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                <td className="px-3 py-2" colSpan={2}>
                  {sorted.length} project{sorted.length === 1 ? '' : 's'}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtGBP(totals.budget)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtGBP(totals.spent)}</td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                    totals.variance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {totals.variance < 0 ? '−' : ''}
                  {fmtGBP(Math.abs(totals.variance))}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  {totals.budget > 0 ? fmtPct((totals.variance / totals.budget) * 100) : '—'}
                </td>
                <td className="px-3 py-2" colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'good' | 'bad'
}) {
  const valueColor =
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'bad'
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-900 dark:text-gray-100'
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  )
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { v: string; l: string }[]
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</span>
      <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
              value === o.v
                ? 'bg-[#2F4B8F] text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  )
}

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
  align?: 'left' | 'right' | 'center'
}) {
  const active = sortKey === k
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  return (
    <th className="px-3 py-2 font-semibold">
      <button
        onClick={() => onSort(k)}
        className={`inline-flex w-full items-center gap-1 ${justify} ${active ? 'text-[#2F4B8F] dark:text-blue-400' : 'hover:text-gray-700 dark:hover:text-gray-200'}`}
      >
        <span>{label}</span>
        {active ? (
          sortDir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  )
}
