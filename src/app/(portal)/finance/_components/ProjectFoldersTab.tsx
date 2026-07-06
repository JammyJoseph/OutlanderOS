'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { AlertTriangle, ArrowLeft, ArrowUpRight, Briefcase, Clapperboard, FolderOpen, LayoutGrid, List, Lock, TrendingDown, TrendingUp } from 'lucide-react'
import { StatusBadge, ErrorBox, TabSkeleton, EmptyState, BudgetBar } from './FinanceBits'
import {
  useFinanceFetch,
  fmtGBP,
  fmtPct,
  fmtDate,
  displayStatus,
  badgeClass,
  BUDGET_STATUS_STYLES,
  SUBMISSION_STATUS_STYLES,
  INVOICE_STATUS_STYLES,
  OVERAGE_STATUS_STYLES,
  OVERAGE_STATUS_LABELS,
  type ProjectsResponse,
  type ProjectDetailResponse,
  type ProjectSummary,
} from './finance-utils'

const HEALTH_BORDER: Record<string, string> = {
  HEALTHY: 'border-emerald-200 dark:border-emerald-800',
  WARNING: 'border-amber-300 dark:border-amber-800',
  OVERAGE: 'border-red-300 dark:border-red-800',
  NO_BUDGET: 'border-gray-200 dark:border-gray-700',
}

function dealStageLabel(stage: string): string {
  return stage.charAt(0) + stage.slice(1).toLowerCase()
}

function ProjectCard({ p, onOpen }: { p: ProjectSummary; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen()
      }}
      className={`cursor-pointer rounded-xl border bg-white dark:bg-gray-900 p-4 text-left shadow-sm transition-shadow hover:shadow-md ${HEALTH_BORDER[p.overageStatus] ?? 'border-gray-200 dark:border-gray-700'}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{p.campaignName}</p>
          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{p.clientName}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1">
          {p.archived && (
            <span className="inline-flex items-center rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:text-gray-400">
              Archived
            </span>
          )}
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass(OVERAGE_STATUS_STYLES, p.overageStatus)}`}>
            {OVERAGE_STATUS_LABELS[p.overageStatus] ?? p.overageStatus}
          </span>
        </span>
      </div>
      {p.deal && (
        <Link
          href={`/commercial/deals/${p.deal.id}`}
          onClick={(e) => e.stopPropagation()}
          className="mb-2 inline-flex max-w-full items-center gap-1 text-[11px] font-medium text-[#9C7C2E] hover:text-[#9C7C2E]"
        >
          <Briefcase className="h-3 w-3 shrink-0" />
          <span className="truncate">Deal: {p.deal.title}</span>
          <span className="shrink-0 text-gray-400 dark:text-gray-500">· {dealStageLabel(p.deal.stage)}</span>
          <ArrowUpRight className="h-3 w-3 shrink-0" />
        </Link>
      )}
      <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <div>
          <dt className="text-gray-400 dark:text-gray-500">Budget</dt>
          <dd className="font-mono font-semibold text-gray-900 dark:text-gray-100">{fmtGBP(p.totalBudget)}</dd>
        </div>
        <div>
          <dt className="text-gray-400 dark:text-gray-500">Costs logged</dt>
          <dd className={`font-mono font-semibold ${p.overageStatus === 'OVERAGE' ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>{fmtGBP(p.totalCosts)}</dd>
        </div>
        <div>
          <dt className="text-gray-400 dark:text-gray-500">Paid (Xero)</dt>
          <dd className="font-mono text-emerald-600">{fmtGBP(p.totalPaid)}</dd>
        </div>
        <div>
          <dt className="text-gray-400 dark:text-gray-500">Remaining</dt>
          <dd className={`font-mono ${p.remaining < 0 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>{fmtGBP(p.remaining)}</dd>
        </div>
        {p.targetMarginAmount != null && (
          <div className="col-span-2">
            <dt className="text-gray-400 dark:text-gray-500">Target margin</dt>
            <dd className="font-mono font-semibold text-[#9C7C2E]">
              {fmtGBP(p.targetMarginAmount)}
              {p.targetMarginPercent != null && <span className="text-gray-400 dark:text-gray-500"> ({fmtPct(p.targetMarginPercent)})</span>}
            </dd>
          </div>
        )}
      </dl>
      <BudgetBar spent={p.totalCosts} budget={p.totalBudget} />
      <div className="mt-2 flex items-center justify-between">
        <StatusBadge status={p.status} map={BUDGET_STATUS_STYLES} />
        {p.pendingInvoices > 0 && (
          <span className="text-[10px] font-medium text-amber-600">{p.pendingInvoices} open invoice{p.pendingInvoices === 1 ? '' : 's'}</span>
        )}
      </div>
    </div>
  )
}

function ProjectDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const res = useFinanceFetch<ProjectDetailResponse>(`/api/finance/projects/${id}`)
  const [busy, setBusy] = useState(false)

  async function approveBudget() {
    setBusy(true)
    try {
      await fetch(`/api/finance/campaign-budgets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })
      res.reload()
    } finally {
      setBusy(false)
    }
  }

  if (res.loading) return <TabSkeleton />
  if (res.error || res.data?.error) return <ErrorBox message={`Failed to load project: ${res.error ?? res.data?.error}`} />

  const { project, production, deal, economics, invoiceTracking, costsByCategory, invoices, xero } = res.data!
  const over = project.overageStatus === 'OVERAGE'
  const warn = project.overageStatus === 'WARNING'

  const eco = economics
  const hasEconomics = Boolean(eco && (eco.allocations.length > 0 || eco.targetMarginAmount != null))
  const savingsPositive = (eco?.productionSavings ?? 0) >= 0
  const aboveTarget =
    eco?.actualMarginAmount != null &&
    eco?.targetMarginAmount != null &&
    eco.actualMarginAmount >= eco.targetMarginAmount

  const splits = [
    { label: 'Production', value: project.productionBudget },
    { label: 'Media', value: project.mediaBudget },
    { label: 'Internal', value: project.internalBudget },
    { label: 'Other', value: project.otherBudget },
  ].filter((s) => s.value > 0)

  const chartData = [
    { name: 'Budget', budget: Math.round(project.totalBudget), actual: 0 },
    { name: 'Actual', budget: 0, actual: Math.round(project.totalCosts) },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-800 dark:hover:text-gray-200">
          <ArrowLeft className="h-3.5 w-3.5" /> All projects
        </button>
        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} map={BUDGET_STATUS_STYLES} />
          {project.status === 'SUBMITTED' && (
            <button
              onClick={approveBudget}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? '…' : 'Approve Budget'}
            </button>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{project.campaignName}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {project.clientName} · created {fmtDate(project.createdAt)}
        </p>
        {(deal || production) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            {deal && (
              <Link
                href={`/commercial/deals/${deal.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9C7C2E] hover:text-[#9C7C2E]"
              >
                <Briefcase className="h-3 w-3" /> Deal: {deal.title} in Commercial
                <span className="text-gray-400 dark:text-gray-500">· {dealStageLabel(deal.stage)}</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
            {production && (
              <Link
                href={`/production/${production.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#A93B2E] hover:text-red-600"
              >
                <Clapperboard className="h-3 w-3" /> Production: {production.title}
                <span className="text-gray-400 dark:text-gray-500">· {production.status.replace(/_/g, ' ').toLowerCase()}</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </div>

      {(over || warn) && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${over ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {over
            ? `Costs exceed budget by ${fmtGBP(Math.abs(project.remaining))}.`
            : `Costs have reached ${Math.round(project.spendPct ?? 0)}% of budget — ${fmtGBP(project.remaining)} remaining.`}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Budget', value: fmtGBP(project.totalBudget), cls: 'text-gray-900 dark:text-gray-100' },
          { label: 'Costs Logged', value: fmtGBP(project.totalCosts), cls: over ? 'text-red-500' : 'text-gray-900 dark:text-gray-100' },
          { label: 'Paid by Client (Xero)', value: xero.connected ? fmtGBP(xero.totalPaid) : '—', cls: 'text-emerald-600' },
          { label: 'Budget Remaining', value: fmtGBP(project.remaining), cls: project.remaining < 0 ? 'text-red-500' : 'text-[#9C7C2E]' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3.5 shadow-sm">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{s.label}</p>
            <p className={`font-mono text-xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Budget vs actual chart */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Budget vs Actual</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => `£${Number(v ?? 0).toLocaleString('en-GB')}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="budget" name="Budget" fill="#9C7C2E" radius={[3, 3, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill={over ? '#c33b2a' : '#10b981'} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Budget breakdown */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Budget Breakdown</p>
          {splits.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">No budget splits set on this project.</p>
          ) : (
            <ul className="space-y-2.5">
              {splits.map((s) => (
                <li key={s.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">{s.label}</span>
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{fmtGBP(s.value)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className="h-full rounded-full bg-[#9C7C2E]" style={{ width: `${project.totalBudget > 0 ? (s.value / project.totalBudget) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {project.notes && <p className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-[11px] text-gray-500 dark:text-gray-400">{project.notes}</p>}
        </div>
      </div>

      {/* ===== Budget & margin waterfall (deals with finalised economics) ===== */}
      {hasEconomics && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Deal economics */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Deal Economics</p>
                {eco.budgetLocked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <Lock className="h-2.5 w-2.5" /> Locked
                  </span>
                )}
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                  <span className="text-gray-600 dark:text-gray-400">Deal Value</span>
                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">{fmtGBP(eco.dealTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                    Media Spend
                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">100% MARGIN</span>
                  </span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{fmtGBP(eco.mediaSpend)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-50 pt-2">
                  <span className="text-gray-600 dark:text-gray-400">Production Budget</span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{fmtGBP(eco.productionBudget)}</span>
                </div>
                <div className="flex items-center justify-between pl-3">
                  <span className="text-gray-500 dark:text-gray-400">Production Margin{eco.productionMarginPct != null ? ` (${Math.round(eco.productionMarginPct)}%)` : ''}</span>
                  <span className="font-mono font-semibold text-[#9C7C2E]">{fmtGBP(eco.targetMarginAmount)}</span>
                </div>
                <div className="flex items-center justify-between pl-3">
                  <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    Production Hard Costs
                    <span className="rounded-full bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-[#A93B2E]">PRODUCTION</span>
                  </span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{fmtGBP(eco.productionAllocation)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-2 mt-1">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Total Company Revenue</span>
                  <span className="font-mono text-sm font-bold text-emerald-600">{fmtGBP(eco.totalCompanyRevenue)}</span>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">media spend + production margin + production savings</p>
              </div>
            </div>

            {/* Production budget */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Production Budget</p>
                {eco.productionBudgetStatus && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                    {eco.productionBudgetStatus.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                  <span className="text-gray-600 dark:text-gray-400">Production Allocation</span>
                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">{fmtGBP(eco.productionAllocation)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Production Budgeted (line items)</span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{fmtGBP(eco.productionBudgeted)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Production Actuals</span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{fmtGBP(eco.productionActuals)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Production {savingsPositive ? 'Savings' : 'Overspend'}</span>
                  <span className={`inline-flex items-center gap-1 font-mono font-bold ${savingsPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                    {savingsPositive ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                    {savingsPositive ? '+' : '−'}{fmtGBP(Math.abs(eco.productionSavings))}
                  </span>
                </div>
              </div>
              {eco.productionAllocation > 0 && (
                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${eco.productionActuals > eco.productionAllocation ? 'bg-red-500' : 'bg-[#9C7C2E]'}`}
                      style={{ width: `${Math.min((eco.productionActuals / eco.productionAllocation) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                    {fmtGBP(eco.productionActuals)} of {fmtGBP(eco.productionAllocation)} spent (
                    {Math.round((eco.productionActuals / eco.productionAllocation) * 100)}%)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Margin analysis */}
          {eco.targetMarginAmount != null && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Margin Analysis</p>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Target Margin</p>
                  <p className="font-mono text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {fmtGBP(eco.targetMarginAmount)}
                    {eco.targetMarginPercent != null && (
                      <span className="ml-1 text-sm font-semibold text-gray-400 dark:text-gray-500">({fmtPct(eco.targetMarginPercent)})</span>
                    )}
                  </p>
                </div>
                <div className={`rounded-lg px-4 py-3 ${savingsPositive ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${savingsPositive ? 'text-emerald-500' : 'text-red-400'}`}>
                    Production {savingsPositive ? 'Savings' : 'Overspend'}
                  </p>
                  <p className={`font-mono text-2xl font-bold ${savingsPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                    {savingsPositive ? '+' : '−'}{fmtGBP(Math.abs(eco.productionSavings))}
                  </p>
                </div>
                <div className={`rounded-lg px-4 py-3 ${aboveTarget ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-amber-50 dark:bg-amber-900/30'}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${aboveTarget ? 'text-emerald-500' : 'text-amber-500'}`}>
                    Actual Margin
                  </p>
                  <p className={`font-mono text-2xl font-bold ${aboveTarget ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {fmtGBP(eco.actualMarginAmount)}
                    {eco.actualMarginPercent != null && (
                      <span className="ml-1 text-sm font-semibold opacity-60">({fmtPct(eco.actualMarginPercent)})</span>
                    )}
                  </p>
                </div>
              </div>
              {/* Target margin bar + savings stacked against the deal total */}
              {eco.dealTotal > 0 && (
                <div>
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full bg-[#9C7C2E]"
                      style={{ width: `${Math.min((eco.targetMarginAmount / eco.dealTotal) * 100, 100)}%` }}
                      title={`Target margin ${fmtGBP(eco.targetMarginAmount)}`}
                    />
                    {eco.productionSavings > 0 && (
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${Math.min((eco.productionSavings / eco.dealTotal) * 100, 100)}%` }}
                        title={`Production savings ${fmtGBP(eco.productionSavings)}`}
                      />
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#9C7C2E]" /> Target margin</span>
                    {eco.productionSavings > 0 && (
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Production savings</span>
                    )}
                    <span className="ml-auto font-mono">of {fmtGBP(eco.dealTotal)} deal total</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scope creep — additional deliverables billed on top of the deal */}
          {eco.deliverables && (eco.deliverables.additionalCount > 0 || eco.deliverables.contractedCount > 0) && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Deliverables &amp; Scope Creep</p>
                {eco.deliverables.additionalOverage > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    +{fmtGBP(eco.deliverables.additionalOverage)} overage
                  </span>
                )}
              </div>
              <div className="mb-3 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Contracted</p>
                  <p className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">{eco.deliverables.contractedCount}</p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">Additional</p>
                  <p className="font-mono text-lg font-bold text-amber-700">{eco.deliverables.additionalCount}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Total Overages</p>
                  <p className="font-mono text-lg font-bold text-emerald-700">{fmtGBP(eco.deliverables.additionalOverage)}</p>
                </div>
              </div>
              {eco.deliverables.additional.length > 0 && (
                <table className="w-full text-[11px]">
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {eco.deliverables.additional.map((d) => (
                      <tr key={d.id}>
                        <td className="py-1.5 text-gray-700 dark:text-gray-300">{d.title}</td>
                        <td className="py-1.5 text-gray-400 dark:text-gray-500">{d.approvedBy ? `approved by ${d.approvedBy}` : 'unapproved'}</td>
                        <td className="py-1.5 text-right font-mono font-semibold text-emerald-600">+{fmtGBP(d.overageCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Final P&L */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Final P&L</p>
              {eco.targetMarginAmount != null && eco.finalPL.grossProfit !== 0 && (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                  eco.finalPL.grossProfit >= eco.targetMarginAmount ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                }`}>
                  {eco.finalPL.grossProfit >= eco.targetMarginAmount ? 'Above target margin' : 'Below target margin'}
                </span>
              )}
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                <tr>
                  <td className="py-2 text-gray-600 dark:text-gray-400">Revenue (deal budget)</td>
                  <td className="py-2 text-right font-mono font-semibold text-gray-900 dark:text-gray-100">{fmtGBP(eco.finalPL.dealValue)}</td>
                </tr>
                {eco.finalPL.additionalOverage > 0 && (
                  <tr>
                    <td className="py-2 pl-4 text-emerald-600">+ Scope creep (additional deliverables)</td>
                    <td className="py-2 text-right font-mono font-semibold text-emerald-600">+{fmtGBP(eco.finalPL.additionalOverage)}</td>
                  </tr>
                )}
                {eco.finalPL.additionalOverage > 0 && (
                  <tr className="bg-emerald-50/40 dark:bg-emerald-900/20">
                    <td className="py-2 font-semibold text-gray-700 dark:text-gray-300">Total Revenue</td>
                    <td className="py-2 text-right font-mono font-semibold text-gray-900 dark:text-gray-100">{fmtGBP(eco.finalPL.revenue)}</td>
                  </tr>
                )}
                {eco.allocations.filter((a) => !a.isProductionBudget).map((a) => (
                  <tr key={a.name}>
                    <td className="py-2 pl-4 text-gray-500 dark:text-gray-400">{a.name}</td>
                    <td className="py-2 text-right font-mono text-gray-700 dark:text-gray-300">−{fmtGBP(a.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 pl-4 text-gray-500 dark:text-gray-400">Production (actuals)</td>
                  <td className="py-2 text-right font-mono text-gray-700 dark:text-gray-300">−{fmtGBP(eco.finalPL.productionActuals)}</td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold text-gray-700 dark:text-gray-300">Total Costs</td>
                  <td className="py-2 text-right font-mono font-semibold text-gray-900 dark:text-gray-100">−{fmtGBP(eco.finalPL.costs)}</td>
                </tr>
                <tr className="bg-gray-50/60 dark:bg-gray-800/60">
                  <td className="py-2.5 font-bold text-gray-900 dark:text-gray-100">Gross Profit</td>
                  <td className={`py-2.5 text-right font-mono text-sm font-bold ${eco.finalPL.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmtGBP(eco.finalPL.grossProfit)}
                    {eco.finalPL.grossMarginPercent != null && (
                      <span className="ml-1 text-[11px] font-semibold opacity-70">({fmtPct(eco.finalPL.grossMarginPercent)})</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Cost line items by category */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Cost Line Items</p>
        {costsByCategory.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">No costs logged against this project yet.</p>
        ) : (
          <div className="space-y-4">
            {costsByCategory.map((g) => (
              <div key={g.category}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold capitalize text-gray-700 dark:text-gray-300">{g.category}</p>
                  <p className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">{fmtGBP(g.total)}</p>
                </div>
                <table className="w-full text-[11px]">
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {g.entries.map((e) => (
                      <tr key={e.id}>
                        <td className="py-1.5 text-gray-500 dark:text-gray-400">{fmtDate(e.date)}</td>
                        <td className="py-1.5 text-gray-700 dark:text-gray-300">{e.description}</td>
                        <td className="py-1.5 text-gray-500 dark:text-gray-400">{e.vendor ?? '—'}</td>
                        <td className="py-1.5 text-right font-mono text-gray-800 dark:text-gray-200">{fmtGBP(e.amount, { decimals: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Supplier invoices coded to this project */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Supplier Invoices</p>
          {invoiceTracking && invoices.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <p className="text-gray-400 dark:text-gray-500">Invoiced / Paid</p>
                <p className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                  {fmtGBP(invoiceTracking.invoicesTotal)} / <span className="text-emerald-600">{fmtGBP(invoiceTracking.invoicesPaid)}</span>
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <p className="text-gray-400 dark:text-gray-500">Outstanding</p>
                <p className={`font-mono font-semibold ${invoiceTracking.outstandingCount > 0 ? 'text-amber-600' : 'text-gray-800 dark:text-gray-200'}`}>
                  {fmtGBP(invoiceTracking.outstandingAmount)} ({invoiceTracking.outstandingCount})
                </p>
              </div>
              {hasEconomics && eco.productionActuals > 0 && (
                <div className="col-span-2 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                  <p className="text-gray-400 dark:text-gray-500">Invoices vs Production Actuals</p>
                  <p className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                    {fmtGBP(invoiceTracking.invoicesTotal)} invoiced vs {fmtGBP(eco.productionActuals)} reported
                    {Math.abs(invoiceTracking.vsProductionActuals) > 0.01 && (
                      <span className={invoiceTracking.vsProductionActuals > 0 ? 'text-red-500' : 'text-amber-600'}>
                        {' '}({invoiceTracking.vsProductionActuals > 0 ? '+' : '−'}{fmtGBP(Math.abs(invoiceTracking.vsProductionActuals))})
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
          {invoices.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">No supplier invoices coded to this project.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">{inv.supplierName}</p>
                    <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">{fmtDate(inv.receivedAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-gray-700 dark:text-gray-300">{inv.amount != null ? fmtGBP(inv.amount) : '—'}</span>
                    <StatusBadge status={displayStatus(inv.status)} rawKey={inv.status} map={SUBMISSION_STATUS_STYLES} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Xero payment status for the client */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Client Payments (Xero)</p>
          {!xero.connected ? (
            <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">Connect Xero to see payment status for {project.clientName}.</p>
          ) : xero.clientInvoices.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">No Xero invoices found for “{project.clientName}”.</p>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">
                Invoiced <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{fmtGBP(xero.totalInvoiced)}</span> · paid{' '}
                <span className="font-mono font-semibold text-emerald-600">{fmtGBP(xero.totalPaid)}</span>
              </p>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {xero.clientInvoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">{fmtDate(inv.date)}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-700 dark:text-gray-300">{fmtGBP(inv.amount, { decimals: true })}</span>
                      <StatusBadge status={inv.status} map={INVOICE_STATUS_STYLES} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Compact line-by-line list, grouped by client (all Puma projects together,
// all Nike together…). Clients are ordered by their most recently updated
// project so a freshly submitted budget's client floats to the top.
function ClientGroupedList({ projects, onOpen }: { projects: ProjectSummary[]; onOpen: (p: ProjectSummary) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, { clientName: string; rows: ProjectSummary[]; latest: string }>()
    for (const p of projects) {
      const key = p.clientId ?? p.clientName.trim().toLowerCase()
      const g = map.get(key) ?? { clientName: p.clientName, rows: [], latest: p.updatedAt }
      g.rows.push(p)
      if (p.updatedAt > g.latest) g.latest = p.updatedAt
      map.set(key, g)
    }
    const arr = Array.from(map.values())
    arr.forEach((g) => g.rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    return arr.sort((a, b) => b.latest.localeCompare(a.latest))
  }, [projects])

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const clientBudget = g.rows.reduce((s, p) => s + p.budgetExVat, 0)
        const clientSpent = g.rows.reduce((s, p) => s + p.spent, 0)
        return (
          <div key={g.clientName} className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/70 px-4 py-2.5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">
                {g.clientName} <span className="ml-1 font-medium normal-case tracking-normal text-gray-400 dark:text-gray-500">· {g.rows.length} project{g.rows.length === 1 ? '' : 's'}</span>
              </p>
              <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                {fmtGBP(clientBudget)} budget · <span className={clientSpent > clientBudget ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}>{fmtGBP(clientSpent)} spent</span>
              </p>
            </div>
            {/* Column headers */}
            <div className="hidden grid-cols-12 gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 sm:grid">
              <div className="col-span-4">Project</div>
              <div className="col-span-2 text-right">Budget (exc. VAT)</div>
              <div className="col-span-2 text-right">Spent</div>
              <div className="col-span-1 text-right">Variance</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Updated</div>
            </div>
            <ul className="divide-y divide-gray-50 dark:divide-gray-800">
              {g.rows.map((p) => {
                const variance = p.budgetExVat - p.spent
                return (
                  <li
                    key={p.id}
                    onClick={() => onOpen(p)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onOpen(p)
                    }}
                    className={`grid cursor-pointer grid-cols-2 gap-2 px-4 py-2.5 text-xs transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-800/70 sm:grid-cols-12 ${p.archived ? 'opacity-60' : ''}`}
                  >
                    <div className="col-span-2 min-w-0 sm:col-span-4">
                      <p className="flex items-center gap-1.5 truncate font-semibold text-gray-900 dark:text-gray-100">
                        {p.source === 'production' && <Clapperboard className="h-3 w-3 shrink-0 text-[#A93B2E]" />}
                        <span className="truncate">{p.campaignName}</span>
                        {p.archived && <span className="shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500">Archived</span>}
                      </p>
                      {p.shootDate && <p className="text-[10px] text-gray-400 dark:text-gray-500">Shoot {fmtDate(p.shootDate)}</p>}
                    </div>
                    <div className="text-right font-mono text-gray-900 sm:col-span-2">
                      <span className="text-gray-400 sm:hidden">Budget </span>{fmtGBP(p.budgetExVat)}
                    </div>
                    <div className={`text-right font-mono sm:col-span-2 ${p.spent > p.budgetExVat ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                      <span className="text-gray-400 sm:hidden">Spent </span>{fmtGBP(p.spent)}
                    </div>
                    <div className={`text-right font-mono sm:col-span-1 ${variance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {variance < 0 ? '−' : ''}{fmtGBP(Math.abs(variance))}
                    </div>
                    <div className="sm:col-span-2">
                      <StatusBadge status={displayStatus(p.status)} rawKey={p.status} map={BUDGET_STATUS_STYLES} />
                    </div>
                    <div className="text-right font-mono text-[10px] text-gray-400 sm:col-span-1">{fmtDate(p.updatedAt)}</div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export default function ProjectFoldersTab() {
  const router = useRouter()
  const params = useSearchParams()
  const selected = params.get('project')
  const res = useFinanceFetch<ProjectsResponse>('/api/finance/projects')
  const [filter, setFilter] = useState('ALL')
  const [showArchived, setShowArchived] = useState(false)
  const [view, setView] = useState<'cards' | 'list'>('list')

  const projects = useMemo(() => {
    // Archived projects (deal archived in Commercial) are hidden by default —
    // the folder and its records are kept for history.
    const all = (res.data?.projects ?? []).filter((p) => showArchived || !p.archived)
    if (filter === 'ALL') return all
    if (filter === 'ATTENTION') return all.filter((p) => p.overageStatus === 'OVERAGE' || p.overageStatus === 'WARNING')
    return all.filter((p) => p.status === filter)
  }, [res.data, filter, showArchived])

  // Standalone productions don't have a finance detail folder — open them in
  // the Production portal. Commercial folders open the finance detail view.
  function openProject(p: ProjectSummary) {
    if (p.source === 'production' && p.productionId) {
      router.push(`/production/${p.productionId}`)
    } else {
      router.push(`/finance?tab=projects&project=${p.id}`)
    }
  }

  function open(id: string | null) {
    router.push(id ? `/finance?tab=projects&project=${id}` : '/finance?tab=projects')
  }

  if (selected) return <ProjectDetail id={selected} onBack={() => open(null)} />

  if (res.loading) return <TabSkeleton />
  if (res.error || res.data?.error) return <ErrorBox message={`Failed to load projects: ${res.error ?? res.data?.error}`} />

  const visible = (res.data?.projects ?? []).filter((p) => showArchived || !p.archived)
  const archivedCount = (res.data?.projects ?? []).filter((p) => p.archived).length
  const all = visible
  const filters = [
    { label: 'All', value: 'ALL', count: all.length },
    { label: 'Needs Attention', value: 'ATTENTION', count: all.filter((p) => p.overageStatus === 'OVERAGE' || p.overageStatus === 'WARNING').length },
    { label: 'Awaiting Approval', value: 'SUBMITTED', count: all.filter((p) => p.status === 'SUBMITTED').length },
    { label: 'Approved', value: 'APPROVED', count: all.filter((p) => p.status === 'APPROVED').length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.value ? 'bg-[#9C7C2E] text-gray-900' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {f.label} <span className={filter === f.value ? 'text-gray-700' : 'text-gray-400'}>({f.count})</span>
          </button>
        ))}
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${showArchived ? 'bg-gray-300 text-gray-800' : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
          </button>
        )}
        {/* Cards ⇄ compact list, grouped by client */}
        <div className="ml-auto flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
          {([
            { key: 'list', label: 'List', Icon: List },
            { key: 'cards', label: 'Cards', Icon: LayoutGrid },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${view === key ? 'bg-[#9C7C2E] text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
            >
              <Icon className="h-3 w-3" /> {label}
            </button>
          ))}
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState message={all.length === 0 ? 'No projects with financial activity yet — budgets from Commercial and production budgets appear here.' : 'No projects match this filter.'} />
      ) : view === 'list' ? (
        <ClientGroupedList projects={projects} onOpen={openProject} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className={p.archived ? 'opacity-60 grayscale' : undefined}>
              <ProjectCard p={p} onOpen={() => openProject(p)} />
            </div>
          ))}
        </div>
      )}

      {all.length > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <FolderOpen className="h-3.5 w-3.5" />
          {all.length} project{all.length === 1 ? '' : 's'} · {fmtGBP(res.data?.totalBudget)} total budget (exc. VAT) · {fmtGBP(res.data?.totalCosts)} spent
        </p>
      )}
    </div>
  )
}
