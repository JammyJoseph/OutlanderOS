'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { ArrowRight, Clock } from 'lucide-react'
import KPICard from './KPICard'
import { XeroStatusDot, XeroDisconnectedBanner, ErrorBox, TabSkeleton } from './FinanceBits'
import {
  useFinanceFetch,
  fmtGBP,
  fmtPct,
  marginPct,
  daysUntil,
  type OverviewResponse,
  type InvoiceSubmissionsResponse,
  type InvoicesResponse,
} from './finance-utils'

interface MonthPoint {
  month: string
  revenue: number
  expenses: number
}

// Pulls the last 6 calendar months of P&L from the overview endpoint
// (which accepts ?from&to). Only mounts when Xero is connected.
function CashFlowTrend() {
  const [points, setPoints] = useState<MonthPoint[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
      return { label: d.toLocaleDateString('en-GB', { month: 'short' }), from, to }
    })

    Promise.all(
      months.map((m) =>
        fetch(`/api/finance/overview?from=${m.from}&to=${m.to}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j: OverviewResponse | null) => ({
            month: m.label,
            revenue: Math.round(j?.profitAndLoss?.revenue ?? 0),
            expenses: Math.round(j?.profitAndLoss?.expenses ?? 0),
          }))
          .catch(() => ({ month: m.label, revenue: 0, expenses: 0 })),
      ),
    ).then((res) => {
      if (!cancelled) setPoints(res)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Revenue vs Expenses — Last 6 Months
      </p>
      {!points ? (
        <div className="h-[260px] animate-pulse rounded-lg bg-gray-50" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={points} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => `£${Number(v ?? 0).toLocaleString('en-GB')}`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function PendingAction({ label, value, href, urgent }: { label: string; value: string; href?: string; urgent?: boolean }) {
  const inner = (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${urgent ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
        <p className={`mt-0.5 text-lg font-bold ${urgent ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
      </div>
      {href && <ArrowRight className="h-4 w-4 text-gray-400" />}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default function OverviewTab() {
  const ov = useFinanceFetch<OverviewResponse>('/api/finance/overview')
  const subs = useFinanceFetch<InvoiceSubmissionsResponse>('/api/finance/invoice-submissions')
  const inv = useFinanceFetch<InvoicesResponse>('/api/finance/invoices?status=AUTHORISED')

  if (ov.loading) return <TabSkeleton />
  if (ov.error || ov.data?.error) return <ErrorBox message={`Failed to load overview: ${ov.error ?? ov.data?.error}`} />

  const o = ov.data!
  const connected = o.xeroConnected
  const pl = o.profitAndLoss
  const margin = marginPct(pl.profit, pl.revenue)

  const submissions = subs.data?.submissions ?? []
  const awaitingReview = submissions.filter((s) => s.status === 'RECEIVED' || s.status === 'REVIEWED').length
  const deadlinesThisWeek = submissions.filter((s) => {
    if (s.status === 'PAID' || s.status === 'REJECTED') return false
    const d = daysUntil(s.paymentDeadline)
    return d !== null && d >= 0 && d <= 7
  }).length

  const invoices = inv.data?.invoices ?? []
  const overdueCount = invoices.filter((i) => {
    const d = daysUntil(i.dueDate)
    return i.status !== 'PAID' && d !== null && d < 0
  }).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <XeroStatusDot connected={connected} error={o.xeroError} organisation={o.organisation} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KPICard label="Revenue YTD" value={connected ? fmtGBP(pl.revenue) : '—'} accent="positive" />
        <KPICard label="Expenses YTD" value={connected ? fmtGBP(pl.expenses) : '—'} accent="negative" />
        <KPICard label="Gross Profit" value={connected ? fmtGBP(pl.profit) : '—'} accent="amber" />
        <KPICard label="Profit Margin" value={connected ? fmtPct(margin) : '—'} accent={margin && margin >= 0 ? 'positive' : 'negative'} />
        <KPICard label="Bank Balance" value={connected ? fmtGBP(o.bankBalance?.balance) : '—'} accent={(o.bankBalance?.balance ?? 0) >= 0 ? 'positive' : 'negative'} sub={o.bankBalance?.accountName || undefined} />
      </div>

      {!connected && <XeroDisconnectedBanner message={`Xero is disconnected${o.xeroError ? ` (${o.xeroError})` : ''} — P&L and bank figures are unavailable.`} />}

      {/* Outstanding money */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <KPICard label="Invoices Outstanding" value={connected ? fmtGBP(o.outstandingInvoices) : '—'} accent="amber" sub={`${o.invoiceCount ?? 0} authorised invoices`} />
        <KPICard label="Overdue Receivables" value={connected ? fmtGBP(o.overdueTotal) : '—'} accent={(o.overdueTotal ?? 0) > 0 ? 'negative' : 'default'} sub={overdueCount > 0 ? `${overdueCount} overdue` : undefined} />
      </div>

      {/* Cash flow trend */}
      {connected ? <CashFlowTrend /> : null}

      {/* Pending actions */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <Clock className="h-3 w-3" /> Pending Actions
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PendingAction label="Invoices Awaiting Review" value={String(awaitingReview)} href="/finance?tab=invoicing" urgent={awaitingReview > 0} />
          <PendingAction label="Overdue Receivables" value={String(overdueCount)} href="/finance?tab=invoicing" urgent={overdueCount > 0} />
          <PendingAction label="Payment Deadlines This Week" value={String(deadlinesThisWeek)} href="/finance?tab=invoicing" urgent={deadlinesThisWeek > 0} />
        </div>
      </div>
    </div>
  )
}
