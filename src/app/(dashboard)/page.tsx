'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { BillingAlert } from '@/lib/billing-engine'

// ---- Types ----

interface SlackMember {
  name: string
  email: string
  presence: string
  statusText: string
  statusEmoji: string
}

interface Deal {
  id: number
  ioNumber: string
  client: string
  campaign: string
  dateBooked: string
  q1: string
  q2: string
  q3: string
  q4: string
  annualTotal: string
  margin: string
  signed: boolean
  invoiceSent: boolean
  billingInfo?: string[]
}

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  billingAlerts?: BillingAlert[]
  calendar?: {
    todayEvents: Array<{
      id?: string | null
      summary: string
      start: string
      end: string
      location: string
    }>
    error?: string
  }
  billingTracker?: {
    bookedRevenue: string
    gapToTarget: string
    totalDeals: number
    deals: Deal[]
    allDeals?: Deal[]
    invoiceSummary: {
      signed: number
      unsigned: number
      invoicesSent: number
      invoicesNotSent: number
    }
    billingRows: string[][]
    invoicingRows: string[][]
    quarterlyTotals: { q1: number; q2: number; q3: number; q4: number }
    error?: string
  }
}

// ---- Helpers ----

function parseAmount(v: string): number {
  if (!v) return 0
  return parseFloat(v.replace(/[£,\s]/g, '')) || 0
}

function fmt(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function marginColor(marginStr: string): string {
  const n = parseFloat(marginStr.replace('%', ''))
  if (isNaN(n)) return 'bg-zinc-700 text-zinc-300'
  if (n >= 50) return 'bg-green-900 text-green-300'
  if (n >= 30) return 'bg-amber-900 text-amber-300'
  return 'bg-red-900 text-red-300'
}

// ---- Skeleton ----

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-800 rounded ${className}`} />
}

// ---- KPI Card ----

function KpiCard({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass: string
}) {
  return (
    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-5 min-w-0">
      <p className="text-zinc-400 text-xs uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-mono text-2xl font-bold truncate ${valueClass}`}>{value}</p>
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-5 min-w-0">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-7 w-32" />
    </div>
  )
}

// ---- Project Row ----

function dealStatus(deal: Deal): 'Active' | 'Pending' | 'Pipeline' {
  if (!deal.signed) return 'Pipeline'
  if (!deal.invoiceSent) return 'Pending'
  return 'Active'
}

const STATUS_PILL: Record<string, string> = {
  Active: 'bg-green-900 text-green-300',
  Pending: 'bg-amber-900 text-amber-300',
  Pipeline: 'bg-zinc-800 text-zinc-400',
}

const STATUS_BORDER: Record<string, string> = {
  Active: 'border-l-green-500',
  Pending: 'border-l-amber-500',
  Pipeline: 'border-l-zinc-600',
}

function buildTasks(
  deal: Deal,
  alerts: BillingAlert[]
): Array<{ label: string; priority: 'red' | 'amber' }> {
  const tasks: Array<{ label: string; priority: 'red' | 'amber' }> = []
  if (!deal.signed) tasks.push({ label: 'Chase IO signature', priority: 'red' })
  if (deal.signed && !deal.invoiceSent) tasks.push({ label: 'Send invoice', priority: 'amber' })
  for (const alert of alerts) {
    const clientLower = deal.client.toLowerCase()
    const alertClient = (alert.client ?? '').toLowerCase()
    if (alertClient && (alertClient.includes(clientLower) || clientLower.includes(alertClient))) {
      tasks.push({
        label: alert.subject || 'Billing alert',
        priority: alert.priority === 'urgent' || alert.priority === 'high' ? 'red' : 'amber',
      })
    }
  }
  return tasks
}

function ProjectRow({
  deal,
  index,
  alerts,
  isLast,
}: {
  deal: Deal
  index: number
  alerts: BillingAlert[]
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const status = dealStatus(deal)
  const tasks = buildTasks(deal, alerts)
  const amount = parseAmount(deal.annualTotal)
  const dealId = deal.id ?? index

  return (
    <div className={isLast ? '' : 'border-b border-zinc-800'}>
      <div
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 cursor-pointer transition-colors"
      >
        {/* Left */}
        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-sm text-zinc-100">{deal.client}</span>
          {deal.campaign && (
            <span className="text-xs text-zinc-500 truncate max-w-[200px]">{deal.campaign}</span>
          )}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_PILL[status]}`}>
            {status}
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-mono text-sm text-zinc-300">
            {amount > 0 ? fmt(amount) : deal.annualTotal || '—'}
          </span>
          {deal.margin && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${marginColor(deal.margin)}`}>
              {deal.margin}
            </span>
          )}
          {tasks.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold flex items-center justify-center shrink-0">
              {tasks.length}
            </span>
          )}
          <Link
            href={`/projects/${dealId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-zinc-600 hover:text-zinc-200 transition-colors text-sm leading-none px-1"
          >
            →
          </Link>
        </div>
      </div>

      {/* Sub-lines */}
      {expanded && (
        <div className={`border-l-2 ${STATUS_BORDER[status]} ml-4 bg-zinc-950`}>
          {tasks.length === 0 ? (
            <div className="px-4 py-2">
              <span className="text-xs text-zinc-600">No outstanding tasks</span>
            </div>
          ) : (
            <>
              {tasks.slice(0, 3).map((task, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      task.priority === 'red' ? 'bg-red-400' : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-xs text-zinc-400">{task.label}</span>
                </div>
              ))}
              {tasks.length > 3 && (
                <div className="px-4 py-2">
                  <span className="text-xs text-zinc-600">+ {tasks.length - 3} more</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Main Dashboard ----

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [teamStatus, setTeamStatus] = useState<SlackMember[]>([])
  const [showAllReminders, setShowAllReminders] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })

    fetch('/api/slack/team-status')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.members)) setTeamStatus(d.members) })
      .catch(() => {})
  }, [])

  const bt = data?.billingTracker
  const deals: Deal[] = bt?.allDeals ?? bt?.deals ?? []

  // Categorise deals for reminders
  const pendingInvoiceDeals = deals.filter((d) => d.signed && !d.invoiceSent)
  const pipelineDeals = deals.filter((d) => !d.signed)

  // KPI calculations
  const bookedRevenue = bt?.bookedRevenue ?? '£0'
  const gapToTarget = bt?.gapToTarget ?? '£0'
  const signedCount = deals.filter((d) => d.signed).length

  const margins = deals
    .map((d) => parseFloat(d.margin?.replace('%', '') ?? ''))
    .filter((n) => !isNaN(n))
  const avgMargin =
    margins.length > 0
      ? (margins.reduce((a, b) => a + b, 0) / margins.length).toFixed(1) + '%'
      : '—'

  // Quarterly chart data
  const qt = bt?.quarterlyTotals ?? { q1: 0, q2: 0, q3: 0, q4: 0 }
  const chartData = [
    { q: 'Q1', value: qt.q1, color: '#D4A853' },
    { q: 'Q2', value: qt.q2, color: '#4ADE80' },
    { q: 'Q3', value: qt.q3, color: '#60A5FA' },
    { q: 'Q4', value: qt.q4, color: '#A78BFA' },
  ]

  // Priority reminders
  const reminders: Array<{ label: string; priority: 'red' | 'amber' }> = []
  for (const d of pendingInvoiceDeals) {
    reminders.push({ label: `Send invoice to ${d.client}`, priority: 'amber' })
  }
  for (const d of pipelineDeals) {
    reminders.push({ label: `Chase ${d.client} IO signature`, priority: 'red' })
  }
  for (const alert of data?.billingAlerts ?? []) {
    if ((alert as unknown as { urgent?: boolean }).urgent) {
      reminders.push({ label: alert.subject ?? 'Billing alert', priority: 'red' })
    }
  }
  reminders.sort((a, b) => (a.priority === 'red' ? -1 : 1) - (b.priority === 'red' ? -1 : 1))
  const visibleReminders = showAllReminders ? reminders : reminders.slice(0, 5)

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <p>Failed to load dashboard: {error}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-zinc-950 min-h-screen">

      {/* ---- KPI Cards ---- */}
      <div className="flex gap-4">
        {loading ? (
          <>
            <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard label="Booked Revenue YTD" value={bookedRevenue} valueClass="text-green-400" />
            <KpiCard label="Gap to Target" value={gapToTarget} valueClass="text-red-400" />
            <KpiCard label="Average Margin" value={avgMargin} valueClass="text-amber-400" />
            <KpiCard label="Deals Closed" value={String(signedCount)} valueClass="text-white" />
          </>
        )}
      </div>

      {/* ---- Revenue Chart ---- */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest mb-4">
          Quarterly Revenue 2026
        </h2>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <XAxis
                  dataKey="q"
                  tick={{ fill: '#71717a', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => '£' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v)}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip
                  formatter={(value) => [fmt(Number(value ?? 0)), 'Revenue']}
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                  labelStyle={{ color: '#a1a1aa' }}
                  itemStyle={{ color: '#e4e4e7' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.q} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-zinc-600 mt-2 text-center">2025 comparison coming soon</p>
          </>
        )}
      </div>

      {/* ---- Status Row ---- */}
      <div className="grid grid-cols-2 gap-4">
        {/* Billing Monitor */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            Billing Monitor
          </h2>
          {loading ? (
            <Skeleton className="h-5 w-48" />
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              <span className="text-sm text-zinc-300">
                Finance Agent monitoring{' '}
                <span className="font-mono text-zinc-200">billing@</span>
              </span>
              {data?.billingAlerts && data.billingAlerts.length > 0 && (
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-amber-900 text-amber-300">
                  {data.billingAlerts.length} alert{data.billingAlerts.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Team Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            Team Status
          </h2>
          {teamStatus.length === 0 ? (
            loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-600">No team data</p>
            )
          ) : (
            <div className="space-y-1.5">
              {teamStatus.slice(0, 5).map((m) => (
                <div key={m.email} className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      m.presence === 'active' ? 'bg-green-400' : 'bg-zinc-600'
                    }`}
                  />
                  <span className="text-xs text-zinc-300 truncate">{m.name}</span>
                  {m.statusText && (
                    <span className="text-xs text-zinc-600 truncate ml-auto">
                      {m.statusEmoji} {m.statusText}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- Priority Reminders ---- */}
      {!loading && reminders.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest mb-3">
            Priority Reminders
          </h2>
          <div className="space-y-2">
            {visibleReminders.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    r.priority === 'red'
                      ? 'bg-red-900 text-red-300'
                      : 'bg-amber-900 text-amber-300'
                  }`}
                >
                  {r.priority === 'red' ? 'Urgent' : 'Action'}
                </span>
                <span className="text-sm text-zinc-300">{r.label}</span>
              </div>
            ))}
          </div>
          {reminders.length > 5 && (
            <button
              onClick={() => setShowAllReminders(!showAllReminders)}
              className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showAllReminders ? 'Show less' : `Show all ${reminders.length}`}
            </button>
          )}
        </div>
      )}

      {/* ---- Projects ---- */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Projects</h2>
          {!loading && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {deals.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-5 w-3/4" />
              </div>
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-xs text-zinc-600">No projects</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {deals.map((deal, i) => (
              <ProjectRow
                key={deal.id ?? i}
                deal={deal}
                index={i}
                alerts={data?.billingAlerts ?? []}
                isLast={i === deals.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
