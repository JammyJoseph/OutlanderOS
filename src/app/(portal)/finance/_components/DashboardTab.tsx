'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Flag, Landmark } from 'lucide-react'
import KPICard from './KPICard'
import { StatusBadge, XeroStatusDot, XeroDisconnectedBanner, ErrorBox, TabSkeleton, BudgetBar } from './FinanceBits'
import {
  useFinanceFetch,
  fmtGBP,
  fmtPct,
  fmtDate,
  marginPct,
  displayStatus,
  badgeClass,
  SUBMISSION_STATUS_STYLES,
  INVOICE_STATUS_STYLES,
  OVERAGE_STATUS_STYLES,
  OVERAGE_STATUS_LABELS,
  type OverviewResponse,
} from './finance-utils'

function OverageAlerts({ o }: { o: OverviewResponse }) {
  const alerts = o.overageAlerts ?? []
  if (alerts.length === 0) return null
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
      <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
        <AlertTriangle className="h-3 w-3" /> Budget Alerts — {alerts.length} project{alerts.length === 1 ? '' : 's'} need attention
      </p>
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li key={a.id}>
            <Link
              href={`/finance?tab=projects&project=${a.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-100 bg-white px-3 py-2 transition-colors hover:border-red-300"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-gray-900">{a.campaignName}</p>
                <p className="truncate text-[10px] text-gray-500">{a.clientName}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-gray-600">
                  {fmtGBP(a.totalCosts)} / {fmtGBP(a.totalBudget)}
                </span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass(OVERAGE_STATUS_STYLES, a.overageStatus)}`}>
                  {a.overageStatus === 'OVERAGE' ? `${fmtGBP(Math.abs(a.overBy))} over` : OVERAGE_STATUS_LABELS[a.overageStatus]}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CashPosition({ o }: { o: OverviewResponse }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Bank Balance (Xero)</p>
        <p className={`font-mono text-2xl font-bold tabular-nums ${(o.bankBalance?.balance ?? 0) >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
          {o.xeroConnected ? fmtGBP(o.bankBalance?.balance) : '—'}
        </p>
        {o.bankBalance?.accountName && <p className="mt-1 text-[11px] text-gray-400">{o.bankBalance.accountName}</p>}
      </div>
      <div className="flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-5">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            <Landmark className="h-3 w-3" /> Cash Position — Wize
          </p>
          <p className="text-xs text-gray-500">Connect Wize to see multi-currency balances and upcoming transfers alongside Xero.</p>
        </div>
        <button
          disabled
          className="shrink-0 cursor-not-allowed rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-400"
          title="Wize integration coming soon"
        >
          Connect Wize
        </button>
      </div>
    </div>
  )
}

function ActivityFeed({ o }: { o: OverviewResponse }) {
  const items = o.recentActivity ?? []
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Recent Invoice Activity</p>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">No invoice activity yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((a) => (
            <li key={`${a.type}-${a.id}`} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${a.type === 'incoming' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                  {a.type === 'incoming' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-xs font-medium text-gray-900">
                    {a.label}
                    {a.flagged && <Flag className="h-3 w-3 shrink-0 text-red-500" />}
                  </p>
                  <p className="truncate text-[10px] text-gray-400">
                    {a.type === 'incoming' ? 'Supplier invoice' : 'Client invoice'}
                    {a.detail ? ` · ${a.detail}` : ''} · {fmtDate(a.date)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-xs text-gray-700">{a.amount != null ? fmtGBP(a.amount) : '—'}</span>
                <StatusBadge
                  status={displayStatus(a.status)}
                  map={a.type === 'incoming' ? SUBMISSION_STATUS_STYLES : INVOICE_STATUS_STYLES}
                  rawKey={a.status}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function DashboardTab() {
  const ov = useFinanceFetch<OverviewResponse>('/api/finance/overview')

  if (ov.loading) return <TabSkeleton />
  if (ov.error || ov.data?.error) return <ErrorBox message={`Failed to load dashboard: ${ov.error ?? ov.data?.error}`} />

  const o = ov.data!
  const connected = o.xeroConnected
  const pl = o.profitAndLoss
  const margin = marginPct(pl.profit, pl.revenue)

  return (
    <div className="space-y-5">
      <XeroStatusDot connected={connected} error={o.xeroError} organisation={o.organisation} />

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          label="Outstanding Receivables"
          value={connected ? fmtGBP(o.outstandingReceivables) : '—'}
          accent="positive"
          sub={connected ? `${o.receivableCount} invoices · ${fmtGBP(o.overdueReceivables)} overdue` : 'Requires Xero'}
        />
        <KPICard
          label="Outstanding Payables"
          value={connected ? fmtGBP(o.outstandingPayables) : '—'}
          accent="negative"
          sub={connected ? `${o.payableCount} bills in Xero` : 'Requires Xero'}
        />
        <KPICard
          label="Pending Approval"
          value={String(o.pendingApprovals)}
          accent={o.pendingApprovals > 0 ? 'amber' : 'default'}
          sub={o.flaggedCount > 0 ? `${o.flaggedCount} flagged` : 'Supplier invoices'}
        />
        <KPICard label="Active Projects" value={String(o.activeProjects)} sub="With budget set" />
      </div>

      {!connected && <XeroDisconnectedBanner message={`Xero is disconnected${o.xeroError ? ` (${o.xeroError})` : ''} — receivables, payables and P&L are unavailable.`} />}

      <OverageAlerts o={o} />

      {/* P&L snapshot */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">P&amp;L Snapshot — Year to Date (Xero)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-[11px] text-gray-400">Revenue</p>
            <p className="font-mono text-lg font-bold text-emerald-600">{connected ? fmtGBP(pl.revenue) : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Expenses</p>
            <p className="font-mono text-lg font-bold text-red-500">{connected ? fmtGBP(pl.expenses) : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Profit</p>
            <p className="font-mono text-lg font-bold text-[#D4A853]">{connected ? fmtGBP(pl.profit) : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Margin</p>
            <p className={`font-mono text-lg font-bold ${(margin ?? 0) >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{connected ? fmtPct(margin) : '—'}</p>
          </div>
        </div>
        {connected && pl.revenue > 0 && (
          <div className="mt-4 max-w-xs">
            <BudgetBar spent={pl.expenses} budget={pl.revenue} />
            <p className="mt-1 text-[10px] text-gray-400">Expenses as a share of revenue</p>
          </div>
        )}
      </div>

      <CashPosition o={o} />
      <ActivityFeed o={o} />
    </div>
  )
}
