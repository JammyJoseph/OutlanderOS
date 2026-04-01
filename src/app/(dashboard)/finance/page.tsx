'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, Loader2, RefreshCw, TrendingUp, FileText, CheckSquare, Send, Flag } from 'lucide-react'
import type { BillingAlert } from '@/lib/billing-engine'

interface Deal {
  ioNumber: string
  client: string
  campaign: string
  dateBooked: string
  annualTotal: string
  margin: string
}

interface InvoiceSummary {
  signed: number
  unsigned: number
  invoicesSent: number
  invoicesNotSent: number
}

interface BillingTracker {
  bookedRevenue: string
  gapToTarget: string
  totalDeals: number
  deals: Deal[]
  allDeals: Deal[]
  invoiceSummary: InvoiceSummary
  invoicingRows?: string[][]
  error?: string
}

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  billingAlerts?: BillingAlert[]
  billingTracker?: BillingTracker
}

type Tab = 'overview' | 'billing' | 'revenue' | 'expenses'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'billing', label: 'Billing' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'expenses', label: 'Expenses' },
]

const ALERT_TYPE_LABELS: Record<BillingAlert['type'], string> = {
  invoice_received: 'Invoice',
  payment_overdue: 'Overdue',
  follow_up_needed: 'Follow Up',
  payment_confirmed: 'Paid',
  new_inquiry: 'Inquiry',
}

const ALERT_TYPE_COLORS: Record<BillingAlert['type'], string> = {
  invoice_received: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  payment_overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
  follow_up_needed: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  payment_confirmed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  new_inquiry: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

const PRIORITY_COLORS: Record<BillingAlert['priority'], string> = {
  urgent: 'text-red-400 bg-red-500/10 border-red-500/30',
  high: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  medium: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  low: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
}

function senderName(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : from.replace(/<[^>]+>/, '').trim()
}

function formatAlertDate(raw: string) {
  if (!raw) return ''
  try {
    return new Date(raw).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch {
    return raw
  }
}

function StatTile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-[#D4A853]/30 bg-[#D4A853]/5' : 'border-zinc-800 bg-zinc-900'}`}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-[#D4A853]' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ---- Tabs ----

function OverviewTab({ bt }: { bt: BillingTracker }) {
  if (bt.error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/10 px-4 py-3 text-sm text-red-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Failed to load billing tracker: {bt.error}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Revenue Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Booked Revenue YTD" value={bt.bookedRevenue} accent />
          <StatTile label="Gap to Target" value={bt.gapToTarget} />
          <StatTile label="Total Deals" value={bt.totalDeals} />
          <StatTile
            label="Outstanding Invoices"
            value={bt.invoiceSummary.unsigned + bt.invoiceSummary.invoicesNotSent}
            sub="unsigned + unsent"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Invoice Status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-emerald-800/30 bg-emerald-900/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-zinc-500">Signed</span>
            </div>
            <p className="text-2xl font-bold text-white">{bt.invoiceSummary.signed}</p>
          </div>
          <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-xs text-zinc-500">Unsigned</span>
            </div>
            <p className="text-2xl font-bold text-white">{bt.invoiceSummary.unsigned}</p>
          </div>
          <div className="rounded-xl border border-emerald-800/30 bg-emerald-900/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-zinc-500">Invoices Sent</span>
            </div>
            <p className="text-2xl font-bold text-white">{bt.invoiceSummary.invoicesSent}</p>
          </div>
          <div className="rounded-xl border border-red-800/30 bg-red-900/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-xs text-zinc-500">Not Sent</span>
            </div>
            <p className="text-2xl font-bold text-white">{bt.invoiceSummary.invoicesNotSent}</p>
          </div>
        </div>
      </section>

      {bt.deals.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Top Deals</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="px-4 py-2.5 text-left font-medium text-zinc-500">IO #</th>
                  <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Client</th>
                  <th className="px-4 py-2.5 text-left font-medium text-zinc-500 hidden md:table-cell">Campaign</th>
                  <th className="px-4 py-2.5 text-right font-medium text-zinc-500">Annual Total</th>
                  <th className="px-4 py-2.5 text-right font-medium text-zinc-500 hidden sm:table-cell">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-900/50">
                {bt.deals.map((deal, i) => (
                  <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-400 font-mono">{deal.ioNumber || '—'}</td>
                    <td className="px-4 py-2.5 font-medium text-zinc-100">{deal.client}</td>
                    <td className="px-4 py-2.5 text-zinc-400 hidden md:table-cell">{deal.campaign}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-100">{deal.annualTotal}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-400 hidden sm:table-cell">{deal.margin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function BillingTab({ alerts }: { alerts: BillingAlert[] }) {
  if (!alerts.length) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-12 text-center">
        <FileText className="mx-auto mb-3 h-6 w-6 text-zinc-700" />
        <p className="text-sm text-zinc-500">No billing emails found in the last 7 days.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`rounded-xl border p-4 ${
            alert.priority === 'urgent'
              ? 'border-red-900/30 bg-red-900/5'
              : alert.priority === 'high'
              ? 'border-amber-900/30 bg-amber-900/5'
              : 'border-zinc-800 bg-zinc-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-zinc-100 truncate">
                  {alert.client !== 'Unknown' ? alert.client : senderName(alert.from)}
                </span>
                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${ALERT_TYPE_COLORS[alert.type]}`}>
                  {ALERT_TYPE_LABELS[alert.type]}
                </span>
                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] capitalize ${PRIORITY_COLORS[alert.priority]}`}>
                  {alert.priority}
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate">{alert.subject}</p>
              <p className="text-xs text-zinc-600 line-clamp-2">{alert.snippet}</p>
              <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                <span>{senderName(alert.from)}</span>
                <span>·</span>
                <span>{formatAlertDate(alert.date)}</span>
                {alert.amount && <span className="text-[#D4A853]">{alert.amount}</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 mt-0.5">
              <button className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:border-emerald-700 hover:text-emerald-400 transition-colors">
                <CheckSquare className="h-3 w-3" />
                Approve
              </button>
              <button className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:border-amber-700 hover:text-amber-400 transition-colors">
                <Send className="h-3 w-3" />
                Chase
              </button>
              <button className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:border-red-700 hover:text-red-400 transition-colors">
                <Flag className="h-3 w-3" />
                Flag
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RevenueTab({ bt }: { bt: BillingTracker }) {
  const allDeals = bt.allDeals?.length ? bt.allDeals : bt.deals ?? []

  if (allDeals.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-12 text-center">
        <FileText className="mx-auto mb-2 h-5 w-5 text-zinc-700" />
        <p className="text-sm text-zinc-500">No deals found in tracker.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900">
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500">IO #</th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Client</th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 hidden md:table-cell">Campaign</th>
            <th className="px-4 py-2.5 text-left font-medium text-zinc-500 hidden lg:table-cell">Date Booked</th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500">Annual Total</th>
            <th className="px-4 py-2.5 text-right font-medium text-zinc-500 hidden sm:table-cell">Margin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 bg-zinc-900/50">
          {allDeals.map((deal, i) => (
            <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
              <td className="px-4 py-2.5 text-zinc-400 font-mono">{deal.ioNumber || '—'}</td>
              <td className="px-4 py-2.5 font-medium text-zinc-100">{deal.client}</td>
              <td className="px-4 py-2.5 text-zinc-400 hidden md:table-cell">{deal.campaign}</td>
              <td className="px-4 py-2.5 text-zinc-500 hidden lg:table-cell">{deal.dateBooked}</td>
              <td className="px-4 py-2.5 text-right text-zinc-100">{deal.annualTotal}</td>
              <td className="px-4 py-2.5 text-right text-zinc-400 hidden sm:table-cell">{deal.margin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExpensesTab() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
        <TrendingUp className="h-5 w-5 text-zinc-600" />
      </div>
      <p className="text-sm font-medium text-zinc-400">Connect Xero for expense tracking</p>
      <p className="mt-1 text-xs text-zinc-600">Expense data will appear here once your accounting integration is set up.</p>
      <button
        disabled
        className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-500 cursor-not-allowed"
      >
        Coming soon
      </button>
    </div>
  )
}

// ---- Page ----

function FinancePageInner() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'overview'
  const [activeTab, setActiveTab] = useState<Tab>(
    TABS.some(t => t.id === initialTab) ? initialTab : 'overview'
  )
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading finance data…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-400" />
          <p className="text-sm text-zinc-300">{error}</p>
          <button onClick={() => load()} className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data?.connected.primary) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <TrendingUp className="mx-auto mb-3 h-6 w-6 text-zinc-600" />
          <p className="text-sm font-medium text-zinc-400">Primary account not connected</p>
          <p className="mt-1 text-xs text-zinc-600">Connect operations@outlandermag.com to access the billing tracker.</p>
          <a href="/api/google/connect?label=primary" className="mt-4 inline-block rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-[#C49843] transition-colors">
            Connect
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 py-6 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Finance</h1>
            <p className="text-xs text-zinc-500 mt-0.5">2026 Master Billing Tracker</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-[#D4A853] text-[#D4A853]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && data?.billingTracker && (
          <OverviewTab bt={data.billingTracker} />
        )}
        {activeTab === 'billing' && (
          <BillingTab alerts={data?.billingAlerts || []} />
        )}
        {activeTab === 'revenue' && data?.billingTracker && (
          <RevenueTab bt={data.billingTracker} />
        )}
        {activeTab === 'expenses' && <ExpensesTab />}

        {!data?.billingTracker && activeTab !== 'billing' && activeTab !== 'expenses' && (
          <p className="text-sm text-zinc-500">No billing data available.</p>
        )}

      </div>
    </div>
  )
}

export default function FinancePage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
      </div>
    }>
      <FinancePageInner />
    </Suspense>
  )
}
