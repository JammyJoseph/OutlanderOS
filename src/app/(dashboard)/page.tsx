'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Mail,
} from 'lucide-react'
import type { BillingAlert } from '@/lib/billing-engine'

// ---- Types ----

interface CalendarEvent {
  id: string | null | undefined
  summary: string
  start: string
  end: string
  location: string
}

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

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  billingAlerts?: BillingAlert[]
  calendar?: {
    todayEvents: CalendarEvent[]
    error?: string
  }
  billingTracker?: {
    bookedRevenue: string
    gapToTarget: string
    totalDeals: number
    deals: Deal[]
    invoiceSummary: InvoiceSummary
    error?: string
  }
}

// ---- Helpers ----

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(iso: string) {
  if (!iso) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'All day'
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatAlertDate(raw: string) {
  if (!raw) return ''
  try {
    return new Date(raw).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch {
    return raw
  }
}

function senderName(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : from.replace(/<[^>]+>/, '').trim()
}

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

const PRIORITY_DOT: Record<BillingAlert['priority'], string> = {
  urgent: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-blue-400',
  low: 'bg-zinc-500',
}

// ---- Sub-components ----

function KpiCard({
  label,
  icon: Icon,
  value,
  sub,
  loading,
  error,
  accent,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  value?: string | number
  sub?: string
  loading?: boolean
  error?: boolean
  accent?: boolean
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-4 ${accent ? 'border-[#D4A853]/30 bg-[#D4A853]/5' : 'border-zinc-800 bg-zinc-900'}`}>
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        {loading ? (
          <div className="h-7 w-16 animate-pulse rounded bg-zinc-800" />
        ) : error ? (
          <span className="text-sm text-red-400">Error</span>
        ) : (
          <>
            <span className={`text-2xl font-bold ${accent ? 'text-[#D4A853]' : 'text-white'}`}>{value ?? '—'}</span>
            {sub && <span className="mb-0.5 text-xs text-zinc-500">{sub}</span>}
          </>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </h2>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/10 px-3 py-2 text-xs text-red-400">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {message}
    </div>
  )
}

// ---- Setup wizard ----

function SetupWizard({ billing, primary }: { billing: boolean; primary: boolean }) {
  const steps = [
    {
      id: 'primary',
      label: 'Connect primary Google account',
      description: 'operations@outlandermag.com — Gmail, Calendar, Drive',
      done: primary,
      connectLabel: 'primary',
    },
    {
      id: 'billing',
      label: 'Connect billing Google account',
      description: 'billing@outlandermag.com — Gmail, invoices, finance emails',
      done: billing,
      connectLabel: 'billing',
    },
  ]

  return (
    <div className="flex min-h-full flex-col items-center justify-center py-16 px-4">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">
            Welcome to <span className="text-[#D4A853]">OutlanderOS</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Connect your accounts to activate the dashboard.</p>
        </div>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                step.done ? 'border-emerald-800/40 bg-emerald-900/10' : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                step.done ? 'border-emerald-700/40 bg-emerald-900/20' : 'border-zinc-700 bg-zinc-800'
              }`}>
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <span className="text-sm font-bold text-zinc-400">{i + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.done ? 'text-emerald-300' : 'text-zinc-100'}`}>{step.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{step.description}</p>
              </div>
              <div className="shrink-0">
                {step.done ? (
                  <span className="text-xs text-emerald-500 font-medium">Done</span>
                ) : (
                  <a
                    href={`/api/google/connect?label=${step.connectLabel}`}
                    className="rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-[#C49843] transition-colors"
                  >
                    Connect
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- Connected dashboard ----

function ConnectedDashboard({ data }: { data: DashboardData }) {
  const { billingAlerts, calendar, billingTracker } = data
  const loading = !billingAlerts && !calendar && !billingTracker

  const urgentHighAlerts = (billingAlerts || []).filter(
    a => a.priority === 'urgent' || a.priority === 'high'
  )
  const outstandingInvoices = billingTracker
    ? billingTracker.invoiceSummary.unsigned + billingTracker.invoiceSummary.invoicesNotSent
    : undefined
  const priorityActions = urgentHighAlerts.slice(0, 5)
  const lastScanTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex min-h-full flex-col py-8 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-8">

        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            {getGreeting()}, <span className="text-[#D4A853]">Joe</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{formatDate()}</p>
        </div>

        {/* KPI row */}
        <section>
          <SectionHeader>Live Overview</SectionHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label="Booked Revenue YTD"
              icon={TrendingUp}
              value={billingTracker?.bookedRevenue}
              loading={loading}
              error={!!billingTracker?.error}
              accent
            />
            <KpiCard
              label="Billing Alerts"
              icon={AlertTriangle}
              value={urgentHighAlerts.length}
              sub="urgent + high"
              loading={loading}
            />
            <KpiCard
              label="Today's Events"
              icon={Calendar}
              value={calendar?.todayEvents?.length}
              loading={loading}
              error={!!calendar?.error}
            />
            <KpiCard
              label="Outstanding Invoices"
              icon={FileText}
              value={outstandingInvoices}
              sub="unsigned + unsent"
              loading={loading}
              error={!!billingTracker?.error}
            />
          </div>
        </section>

        {/* Billing Monitor Status */}
        <section>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
              <span className="text-xs font-medium text-zinc-300">Finance Agent monitoring billing@outlandermag.com</span>
            </div>
            <div className="ml-auto flex items-center gap-4 text-xs text-zinc-500">
              <span>Last scan: {lastScanTime}</span>
              <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                {billingAlerts?.length ?? 0} items detected
              </span>
            </div>
          </div>
        </section>

        {/* Priority Actions */}
        <section>
          <SectionHeader>Priority Actions</SectionHeader>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800" />
              ))}
            </div>
          ) : priorityActions.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-6 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-500" />
              <p className="text-sm text-zinc-400">All clear — no urgent or high priority items</p>
            </div>
          ) : (
            <div className="space-y-2">
              {priorityActions.map(alert => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                    alert.priority === 'urgent'
                      ? 'border-red-900/30 bg-red-900/10'
                      : 'border-amber-900/30 bg-amber-900/10'
                  }`}
                >
                  <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[alert.priority]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{alert.subject || '(no subject)'}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {senderName(alert.from)}{alert.client !== 'Unknown' ? ` · ${alert.client}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${ALERT_TYPE_COLORS[alert.type]}`}>
                      {ALERT_TYPE_LABELS[alert.type]}
                    </span>
                    <span className="text-[10px] text-zinc-600">{formatAlertDate(alert.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Billing Activity */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <SectionHeader>Recent Billing Activity</SectionHeader>
            <Link href="/finance?tab=billing" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-[#D4A853] transition-colors">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-800" />
              ))}
            </div>
          ) : !billingAlerts?.length ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-6 text-center">
              <Mail className="mx-auto mb-2 h-5 w-5 text-zinc-700" />
              <p className="text-sm text-zinc-500">No billing activity in the last 7 days.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              {billingAlerts.slice(0, 6).map(alert => (
                <div key={alert.id} className="flex items-start gap-3 px-4 py-3">
                  <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[alert.priority]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        {alert.client !== 'Unknown' ? alert.client : senderName(alert.from)}
                      </span>
                      <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] ${ALERT_TYPE_COLORS[alert.type]}`}>
                        {ALERT_TYPE_LABELS[alert.type]}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{alert.subject}</p>
                    {alert.amount && <p className="text-xs text-[#D4A853] mt-0.5">{alert.amount}</p>}
                  </div>
                  <span className="shrink-0 text-[10px] text-zinc-600">{formatAlertDate(alert.date)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Today's schedule */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <SectionHeader>Today's Schedule — operations@</SectionHeader>
            <Link href="/calendar" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-[#D4A853] transition-colors">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800" />
              ))}
            </div>
          ) : calendar?.error ? (
            <ErrorBanner message={`Failed to load calendar: ${calendar.error}`} />
          ) : !calendar?.todayEvents?.length ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-6 text-center">
              <p className="text-sm text-zinc-500">No events scheduled for today.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {calendar.todayEvents.map(event => (
                <div key={event.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                  <Clock className="h-4 w-4 shrink-0 text-zinc-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">{event.summary}</p>
                    {event.location && <p className="text-xs text-zinc-500 truncate">{event.location}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400">{formatTime(event.start)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active Deals */}
        {billingTracker && !billingTracker.error && billingTracker.deals.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <SectionHeader>Active Deals</SectionHeader>
              <Link href="/finance" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-[#D4A853] transition-colors">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900">
                    <th className="px-4 py-2.5 text-left font-medium text-zinc-500">IO #</th>
                    <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Client</th>
                    <th className="px-4 py-2.5 text-left font-medium text-zinc-500 hidden sm:table-cell">Campaign</th>
                    <th className="px-4 py-2.5 text-right font-medium text-zinc-500">Annual Total</th>
                    <th className="px-4 py-2.5 text-right font-medium text-zinc-500 hidden sm:table-cell">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-zinc-900/50">
                  {billingTracker.deals.map((deal, i) => (
                    <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-2.5 text-zinc-400 font-mono">{deal.ioNumber || '—'}</td>
                      <td className="px-4 py-2.5 font-medium text-zinc-100">{deal.client}</td>
                      <td className="px-4 py-2.5 text-zinc-400 hidden sm:table-cell">{deal.campaign}</td>
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
    </div>
  )
}

// ---- Page ----

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setFetchError(null)
    } catch (err) {
      setFetchError(String(err))
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (!data) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading dashboard…</span>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex min-h-full items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-400" />
          <p className="text-sm font-medium text-zinc-300">Failed to load dashboard</p>
          <p className="mt-1 text-xs text-zinc-500">{fetchError}</p>
          <button
            onClick={() => load()}
            className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { connected } = data
  if (!connected.billing || !connected.primary) {
    return <SetupWizard billing={connected.billing} primary={connected.primary} />
  }

  return (
    <div className="relative">
      <button
        onClick={() => load(true)}
        disabled={refreshing}
        className="fixed bottom-6 right-6 z-10 flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 shadow-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
      <ConnectedDashboard data={data} />
    </div>
  )
}
