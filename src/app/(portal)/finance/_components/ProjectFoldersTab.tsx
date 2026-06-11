'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { AlertTriangle, ArrowLeft, ArrowUpRight, Briefcase, Clapperboard, FolderOpen, Lock, TrendingDown, TrendingUp } from 'lucide-react'
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
  HEALTHY: 'border-emerald-200',
  WARNING: 'border-amber-300',
  OVERAGE: 'border-red-300',
  NO_BUDGET: 'border-gray-200',
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
      className={`cursor-pointer rounded-xl border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md ${HEALTH_BORDER[p.overageStatus] ?? 'border-gray-200'}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{p.campaignName}</p>
          <p className="truncate text-[11px] text-gray-500">{p.clientName}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass(OVERAGE_STATUS_STYLES, p.overageStatus)}`}>
          {OVERAGE_STATUS_LABELS[p.overageStatus] ?? p.overageStatus}
        </span>
      </div>
      {p.deal && (
        <Link
          href={`/commercial/deals/${p.deal.id}`}
          onClick={(e) => e.stopPropagation()}
          className="mb-2 inline-flex max-w-full items-center gap-1 text-[11px] font-medium text-[#D4A853] hover:text-[#c49843]"
        >
          <Briefcase className="h-3 w-3 shrink-0" />
          <span className="truncate">Deal: {p.deal.title}</span>
          <span className="shrink-0 text-gray-400">· {dealStageLabel(p.deal.stage)}</span>
          <ArrowUpRight className="h-3 w-3 shrink-0" />
        </Link>
      )}
      <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <div>
          <dt className="text-gray-400">Budget</dt>
          <dd className="font-mono font-semibold text-gray-900">{fmtGBP(p.totalBudget)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Costs logged</dt>
          <dd className={`font-mono font-semibold ${p.overageStatus === 'OVERAGE' ? 'text-red-500' : 'text-gray-900'}`}>{fmtGBP(p.totalCosts)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Paid (Xero)</dt>
          <dd className="font-mono text-emerald-600">{fmtGBP(p.totalPaid)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Remaining</dt>
          <dd className={`font-mono ${p.remaining < 0 ? 'text-red-500' : 'text-gray-700'}`}>{fmtGBP(p.remaining)}</dd>
        </div>
        {p.targetMarginAmount != null && (
          <div className="col-span-2">
            <dt className="text-gray-400">Target margin</dt>
            <dd className="font-mono font-semibold text-[#D4A853]">
              {fmtGBP(p.targetMarginAmount)}
              {p.targetMarginPercent != null && <span className="text-gray-400"> ({fmtPct(p.targetMarginPercent)})</span>}
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
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800">
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
        <h2 className="text-lg font-bold text-gray-900">{project.campaignName}</h2>
        <p className="text-xs text-gray-500">
          {project.clientName} · created {fmtDate(project.createdAt)}
        </p>
        {(deal || production) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            {deal && (
              <Link
                href={`/commercial/deals/${deal.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#D4A853] hover:text-[#c49843]"
              >
                <Briefcase className="h-3 w-3" /> Deal: {deal.title} in Commercial
                <span className="text-gray-400">· {dealStageLabel(deal.stage)}</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
            {production && (
              <Link
                href={`/production/${production.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#E24B4A] hover:text-red-600"
              >
                <Clapperboard className="h-3 w-3" /> Production: {production.title}
                <span className="text-gray-400">· {production.status.replace(/_/g, ' ').toLowerCase()}</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </div>

      {(over || warn) && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${over ? 'border-red-300 bg-red-50 text-red-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {over
            ? `Costs exceed budget by ${fmtGBP(Math.abs(project.remaining))}.`
            : `Costs have reached ${Math.round(project.spendPct ?? 0)}% of budget — ${fmtGBP(project.remaining)} remaining.`}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Budget', value: fmtGBP(project.totalBudget), cls: 'text-gray-900' },
          { label: 'Costs Logged', value: fmtGBP(project.totalCosts), cls: over ? 'text-red-500' : 'text-gray-900' },
          { label: 'Paid by Client (Xero)', value: xero.connected ? fmtGBP(xero.totalPaid) : '—', cls: 'text-emerald-600' },
          { label: 'Budget Remaining', value: fmtGBP(project.remaining), cls: project.remaining < 0 ? 'text-red-500' : 'text-[#D4A853]' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{s.label}</p>
            <p className={`font-mono text-xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Budget vs actual chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Budget vs Actual</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => `£${Number(v ?? 0).toLocaleString('en-GB')}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="budget" name="Budget" fill="#D4A853" radius={[3, 3, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill={over ? '#ef4444' : '#10b981'} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Budget breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Budget Breakdown</p>
          {splits.length === 0 ? (
            <p className="text-xs text-gray-400">No budget splits set on this project.</p>
          ) : (
            <ul className="space-y-2.5">
              {splits.map((s) => (
                <li key={s.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-gray-600">{s.label}</span>
                    <span className="font-mono font-semibold text-gray-900">{fmtGBP(s.value)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-[#D4A853]" style={{ width: `${project.totalBudget > 0 ? (s.value / project.totalBudget) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {project.notes && <p className="mt-4 rounded-lg bg-gray-50 p-3 text-[11px] text-gray-500">{project.notes}</p>}
        </div>
      </div>

      {/* ===== Budget & margin waterfall (deals with finalised economics) ===== */}
      {hasEconomics && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Deal economics */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Deal Economics</p>
                {eco.budgetLocked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <Lock className="h-2.5 w-2.5" /> Locked
                  </span>
                )}
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                  <span className="text-gray-600">Total Deal Budget</span>
                  <span className="font-mono text-sm font-bold text-gray-900">{fmtGBP(eco.dealTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Company Margin</span>
                  <span className="font-mono font-semibold text-[#D4A853]">
                    {fmtGBP(eco.targetMarginAmount)}
                    {eco.targetMarginPercent != null && <span className="text-gray-400"> ({fmtPct(eco.targetMarginPercent)})</span>}
                  </span>
                </div>
                {eco.allocations.map((a) => (
                  <div key={a.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      {a.name}
                      {a.isProductionBudget && (
                        <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-[#E24B4A]">PRODUCTION</span>
                      )}
                    </span>
                    <span className="font-mono font-semibold text-gray-900">{fmtGBP(a.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Production budget */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Production Budget</p>
                {eco.productionBudgetStatus && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                    {eco.productionBudgetStatus.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                  <span className="text-gray-600">Production Allocation</span>
                  <span className="font-mono text-sm font-bold text-gray-900">{fmtGBP(eco.productionAllocation)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Production Budgeted (line items)</span>
                  <span className="font-mono font-semibold text-gray-900">{fmtGBP(eco.productionBudgeted)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Production Actuals</span>
                  <span className="font-mono font-semibold text-gray-900">{fmtGBP(eco.productionActuals)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Production {savingsPositive ? 'Savings' : 'Overspend'}</span>
                  <span className={`inline-flex items-center gap-1 font-mono font-bold ${savingsPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                    {savingsPositive ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                    {savingsPositive ? '+' : '−'}{fmtGBP(Math.abs(eco.productionSavings))}
                  </span>
                </div>
              </div>
              {eco.productionAllocation > 0 && (
                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${eco.productionActuals > eco.productionAllocation ? 'bg-red-500' : 'bg-[#D4A853]'}`}
                      style={{ width: `${Math.min((eco.productionActuals / eco.productionAllocation) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400">
                    {fmtGBP(eco.productionActuals)} of {fmtGBP(eco.productionAllocation)} spent (
                    {Math.round((eco.productionActuals / eco.productionAllocation) * 100)}%)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Margin analysis */}
          {eco.targetMarginAmount != null && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Margin Analysis</p>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Target Margin</p>
                  <p className="font-mono text-2xl font-bold text-gray-900">
                    {fmtGBP(eco.targetMarginAmount)}
                    {eco.targetMarginPercent != null && (
                      <span className="ml-1 text-sm font-semibold text-gray-400">({fmtPct(eco.targetMarginPercent)})</span>
                    )}
                  </p>
                </div>
                <div className={`rounded-lg px-4 py-3 ${savingsPositive ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${savingsPositive ? 'text-emerald-500' : 'text-red-400'}`}>
                    Production {savingsPositive ? 'Savings' : 'Overspend'}
                  </p>
                  <p className={`font-mono text-2xl font-bold ${savingsPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                    {savingsPositive ? '+' : '−'}{fmtGBP(Math.abs(eco.productionSavings))}
                  </p>
                </div>
                <div className={`rounded-lg px-4 py-3 ${aboveTarget ? 'bg-emerald-50' : 'bg-amber-50'}`}>
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
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-[#D4A853]"
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
                  <div className="mt-1.5 flex items-center gap-4 text-[10px] text-gray-500">
                    <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#D4A853]" /> Target margin</span>
                    {eco.productionSavings > 0 && (
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Production savings</span>
                    )}
                    <span className="ml-auto font-mono">of {fmtGBP(eco.dealTotal)} deal total</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Final P&L */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Final P&L</p>
              {eco.targetMarginAmount != null && eco.finalPL.grossProfit !== 0 && (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                  eco.finalPL.grossProfit >= eco.targetMarginAmount ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  {eco.finalPL.grossProfit >= eco.targetMarginAmount ? 'Above target margin' : 'Below target margin'}
                </span>
              )}
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-50">
                <tr>
                  <td className="py-2 text-gray-600">Revenue (deal budget)</td>
                  <td className="py-2 text-right font-mono font-semibold text-gray-900">{fmtGBP(eco.finalPL.revenue)}</td>
                </tr>
                {eco.allocations.filter((a) => !a.isProductionBudget).map((a) => (
                  <tr key={a.name}>
                    <td className="py-2 pl-4 text-gray-500">{a.name}</td>
                    <td className="py-2 text-right font-mono text-gray-700">−{fmtGBP(a.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 pl-4 text-gray-500">Production (actuals)</td>
                  <td className="py-2 text-right font-mono text-gray-700">−{fmtGBP(eco.finalPL.productionActuals)}</td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold text-gray-700">Total Costs</td>
                  <td className="py-2 text-right font-mono font-semibold text-gray-900">−{fmtGBP(eco.finalPL.costs)}</td>
                </tr>
                <tr className="bg-gray-50/60">
                  <td className="py-2.5 font-bold text-gray-900">Gross Profit</td>
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
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Cost Line Items</p>
        {costsByCategory.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">No costs logged against this project yet.</p>
        ) : (
          <div className="space-y-4">
            {costsByCategory.map((g) => (
              <div key={g.category}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold capitalize text-gray-700">{g.category}</p>
                  <p className="font-mono text-xs font-semibold text-gray-900">{fmtGBP(g.total)}</p>
                </div>
                <table className="w-full text-[11px]">
                  <tbody className="divide-y divide-gray-100">
                    {g.entries.map((e) => (
                      <tr key={e.id}>
                        <td className="py-1.5 text-gray-500">{fmtDate(e.date)}</td>
                        <td className="py-1.5 text-gray-700">{e.description}</td>
                        <td className="py-1.5 text-gray-500">{e.vendor ?? '—'}</td>
                        <td className="py-1.5 text-right font-mono text-gray-800">{fmtGBP(e.amount, { decimals: true })}</td>
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
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Supplier Invoices</p>
          {invoiceTracking && invoices.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-gray-400">Invoiced / Paid</p>
                <p className="font-mono font-semibold text-gray-800">
                  {fmtGBP(invoiceTracking.invoicesTotal)} / <span className="text-emerald-600">{fmtGBP(invoiceTracking.invoicesPaid)}</span>
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-gray-400">Outstanding</p>
                <p className={`font-mono font-semibold ${invoiceTracking.outstandingCount > 0 ? 'text-amber-600' : 'text-gray-800'}`}>
                  {fmtGBP(invoiceTracking.outstandingAmount)} ({invoiceTracking.outstandingCount})
                </p>
              </div>
              {hasEconomics && eco.productionActuals > 0 && (
                <div className="col-span-2 rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-gray-400">Invoices vs Production Actuals</p>
                  <p className="font-mono font-semibold text-gray-800">
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
            <p className="py-4 text-center text-xs text-gray-400">No supplier invoices coded to this project.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{inv.supplierName}</p>
                    <p className="truncate text-[10px] text-gray-400">{fmtDate(inv.receivedAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-gray-700">{inv.amount != null ? fmtGBP(inv.amount) : '—'}</span>
                    <StatusBadge status={displayStatus(inv.status)} rawKey={inv.status} map={SUBMISSION_STATUS_STYLES} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Xero payment status for the client */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Client Payments (Xero)</p>
          {!xero.connected ? (
            <p className="py-4 text-center text-xs text-gray-400">Connect Xero to see payment status for {project.clientName}.</p>
          ) : xero.clientInvoices.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">No Xero invoices found for “{project.clientName}”.</p>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-gray-500">
                Invoiced <span className="font-mono font-semibold text-gray-800">{fmtGBP(xero.totalInvoiced)}</span> · paid{' '}
                <span className="font-mono font-semibold text-emerald-600">{fmtGBP(xero.totalPaid)}</span>
              </p>
              <ul className="divide-y divide-gray-100">
                {xero.clientInvoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <span className="text-gray-500">{fmtDate(inv.date)}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-700">{fmtGBP(inv.amount, { decimals: true })}</span>
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

export default function ProjectFoldersTab() {
  const router = useRouter()
  const params = useSearchParams()
  const selected = params.get('project')
  const res = useFinanceFetch<ProjectsResponse>('/api/finance/projects')
  const [filter, setFilter] = useState('ALL')

  const projects = useMemo(() => {
    const all = res.data?.projects ?? []
    if (filter === 'ALL') return all
    if (filter === 'ATTENTION') return all.filter((p) => p.overageStatus === 'OVERAGE' || p.overageStatus === 'WARNING')
    return all.filter((p) => p.status === filter)
  }, [res.data, filter])

  function open(id: string | null) {
    router.push(id ? `/finance?tab=projects&project=${id}` : '/finance?tab=projects')
  }

  if (selected) return <ProjectDetail id={selected} onBack={() => open(null)} />

  if (res.loading) return <TabSkeleton />
  if (res.error || res.data?.error) return <ErrorBox message={`Failed to load projects: ${res.error ?? res.data?.error}`} />

  const all = res.data?.projects ?? []
  const filters = [
    { label: 'All', value: 'ALL', count: all.length },
    { label: 'Needs Attention', value: 'ATTENTION', count: all.filter((p) => p.overageStatus === 'OVERAGE' || p.overageStatus === 'WARNING').length },
    { label: 'Awaiting Approval', value: 'SUBMITTED', count: all.filter((p) => p.status === 'SUBMITTED').length },
    { label: 'Approved', value: 'APPROVED', count: all.filter((p) => p.status === 'APPROVED').length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.value ? 'bg-[#D4A853] text-gray-900' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {f.label} <span className={filter === f.value ? 'text-gray-700' : 'text-gray-400'}>({f.count})</span>
          </button>
        ))}
      </div>

      {projects.length === 0 ? (
        <EmptyState message={all.length === 0 ? 'No projects with financial activity yet — budgets created in the Commercial portal appear here.' : 'No projects match this filter.'} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} p={p} onOpen={() => open(p.id)} />
          ))}
        </div>
      )}

      {all.length > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <FolderOpen className="h-3.5 w-3.5" />
          {all.length} project{all.length === 1 ? '' : 's'} · {fmtGBP(res.data?.totalBudget)} total budget · {fmtGBP(res.data?.totalCosts)} costs logged
        </p>
      )}
    </div>
  )
}
