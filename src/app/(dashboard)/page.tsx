'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, PenLine, CheckSquare, ArrowRight } from 'lucide-react'
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

interface XeroData {
  connected: boolean
  organisation?: string
  error?: string
  totalIncome?: number
  totalExpenses?: number
  netProfit?: number
  bankBalance?: number
}

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  billingAlerts?: BillingAlert[]
  xero?: XeroData
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

function dealStatus(deal: Deal): 'Active' | 'Pending' | 'Pipeline' {
  if (!deal.signed) return 'Pipeline'
  if (!deal.invoiceSent) return 'Pending'
  return 'Active'
}

function buildTaskCount(deal: Deal): number {
  let count = 0
  if (!deal.signed) count++
  if (deal.signed && !deal.invoiceSent) count++
  return count
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
  sub,
}: {
  label: string
  value: string
  valueClass: string
  sub?: string
}) {
  return (
    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6 min-w-0">
      <p className="text-zinc-500 text-xs uppercase tracking-widest mb-3">{label}</p>
      <p className={`font-mono text-3xl font-bold truncate ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1.5">{sub}</p>}
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-6 min-w-0">
      <Skeleton className="h-3 w-24 mb-4" />
      <Skeleton className="h-9 w-32" />
    </div>
  )
}

// ---- Insight Card ----

function InsightCard({
  label,
  value,
  valueClass = 'text-zinc-100',
  warn,
  sub,
}: {
  label: string
  value: string
  valueClass?: string
  warn?: boolean
  sub?: string
}) {
  return (
    <div className={`flex-1 min-w-0 bg-zinc-900 border rounded-xl p-4 ${warn ? 'border-amber-700/60' : 'border-zinc-800'}`}>
      <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-mono text-base font-bold truncate ${valueClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-600 mt-1 leading-tight">{sub}</p>}
    </div>
  )
}

// ---- Project Card ----

function ProjectCard({ deal, index, onAction }: { deal: Deal; index: number; alerts?: BillingAlert[]; onAction?: (dealId: number, action: string) => void }) {
  const [hovered, setHovered] = useState(false)
  const status = dealStatus(deal)
  const taskCount = buildTaskCount(deal)
  const amount = parseAmount(deal.annualTotal)
  const dealId = deal.id ?? index

  const statusDot: Record<string, string> = {
    Active: 'bg-green-400',
    Pending: 'bg-amber-400',
    Pipeline: 'bg-zinc-500',
  }

  return (
    <Link
      href={`/projects/${dealId}`}
      className={`relative block bg-zinc-900 border rounded-lg p-4 transition-all cursor-pointer group ${
        hovered ? 'border-amber-500/60 shadow-[0_0_12px_rgba(212,168,83,0.15)]' : 'border-zinc-800'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Task count badge */}
      {taskCount > 0 && (
        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold flex items-center justify-center">
          {taskCount}
        </span>
      )}

      {/* Client + campaign */}
      <div className="pr-6 mb-3">
        <p className="font-semibold text-base text-zinc-100 leading-tight">{deal.client}</p>
        {deal.campaign && (
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{deal.campaign}</p>
        )}
      </div>

      {/* Budget */}
      <p className="font-mono text-lg font-bold text-zinc-200 mb-3">
        {amount > 0 ? fmt(amount) : deal.annualTotal || '—'}
      </p>

      {/* Margin + status */}
      <div className="flex items-center gap-2 flex-wrap">
        {deal.margin && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${marginColor(deal.margin)}`}>
            {deal.margin}
          </span>
        )}
        <span className="flex items-center gap-1 text-[10px] text-zinc-500">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot[status]}`} />
          {status}
        </span>
      </div>

      {/* Action buttons on hover */}
      {hovered && (
        <div
          className="absolute bottom-3 right-3 flex items-center gap-1.5"
          onClick={(e) => e.preventDefault()}
        >
          {!deal.invoiceSent && deal.signed && (
            <button
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-amber-900/80 text-amber-300 hover:bg-amber-800 transition-colors"
              onClick={(e) => { e.preventDefault(); onAction?.(dealId, 'invoice') }}
              title="Send Invoice"
            >
              <FileText className="h-3 w-3" />
              Invoice
            </button>
          )}
          {!deal.signed && (
            <button
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-red-900/80 text-red-300 hover:bg-red-800 transition-colors"
              onClick={(e) => { e.preventDefault(); onAction?.(dealId, 'signature') }}
              title="Chase Signature"
            >
              <PenLine className="h-3 w-3" />
              Sign
            </button>
          )}
        </div>
      )}
    </Link>
  )
}

// ---- Main Dashboard ----

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllReminders, setShowAllReminders] = useState(false)
  const [doneReminders, setDoneReminders] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
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
  const totalDeals = deals.length

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

  // ---- Insights ----
  const totalRevenue = deals.reduce((sum, d) => sum + parseAmount(d.annualTotal), 0)
  const avgDealSize = deals.length > 0 ? totalRevenue / deals.length : 0

  // Top client
  const clientTotals: Record<string, number> = {}
  for (const d of deals) {
    clientTotals[d.client] = (clientTotals[d.client] ?? 0) + parseAmount(d.annualTotal)
  }
  const sortedClients = Object.entries(clientTotals).sort((a, b) => b[1] - a[1])
  const topClient = sortedClients[0]
  const top3Revenue = sortedClients.slice(0, 3).reduce((s, [, v]) => s + v, 0)
  const clientConcentration = totalRevenue > 0 ? Math.round((top3Revenue / totalRevenue) * 100) : 0

  const pipelineValue = deals.filter((d) => !d.signed).reduce((s, d) => s + parseAmount(d.annualTotal), 0)

  const invoicesSent = bt?.invoiceSummary?.invoicesSent ?? 0
  const invoicesTotal = (bt?.invoiceSummary?.invoicesSent ?? 0) + (bt?.invoiceSummary?.invoicesNotSent ?? 0)

  // Currency split
  const currencyCount: Record<string, number> = {}
  for (const d of deals) {
    const raw = d.annualTotal ?? ''
    let currency = 'GBP'
    if (raw.includes('€') || raw.toLowerCase().includes('eur')) currency = 'EUR'
    else if (raw.includes('$') || raw.toLowerCase().includes('usd')) currency = 'USD'
    currencyCount[currency] = (currencyCount[currency] ?? 0) + 1
  }
  const currencySplit = Object.entries(currencyCount)
    .map(([k, v]) => `${v} ${k}`)
    .join(' · ')

  // Priority reminders
  const reminders: Array<{ label: string; priority: 'red' | 'amber'; dealId?: number }> = []
  for (const d of pendingInvoiceDeals) {
    reminders.push({ label: `Send invoice to ${d.client}`, priority: 'amber', dealId: d.id })
  }
  for (const d of pipelineDeals) {
    reminders.push({ label: `Chase ${d.client} IO signature`, priority: 'red', dealId: d.id })
  }
  for (const alert of data?.billingAlerts ?? []) {
    if ((alert as unknown as { urgent?: boolean }).urgent) {
      reminders.push({ label: alert.subject ?? 'Billing alert', priority: 'red' })
    }
  }
  reminders.sort((a, b) => (a.priority === 'red' ? -1 : 1) - (b.priority === 'red' ? -1 : 1))

  const activeReminders = reminders.filter((_, i) => !doneReminders.has(i))
  const visibleReminders = showAllReminders ? activeReminders : activeReminders.slice(0, 5)

  function markDone(originalIndex: number) {
    setDoneReminders((prev) => new Set([...prev, originalIndex]))
  }

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
            <KpiCard
              label="Booked Revenue YTD"
              value={bookedRevenue}
              valueClass="text-green-400"
            />
            <KpiCard
              label="Gap to Target"
              value={gapToTarget}
              valueClass="text-red-400"
            />
            <KpiCard
              label="Avg Margin"
              value={avgMargin}
              valueClass="text-amber-400"
            />
            <KpiCard
              label="Deals Closed / Total"
              value={`${signedCount}/${totalDeals}`}
              valueClass="text-white"
              sub={`${totalDeals - signedCount} unsigned`}
            />
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

      {/* ---- Insights ---- */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Insights</h2>
        {loading ? (
          <div className="flex gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="flex-1 h-16" />)}
          </div>
        ) : (
          <div className="flex gap-3 flex-wrap">
            <InsightCard
              label="Avg Deal Size"
              value={avgDealSize > 0 ? fmt(Math.round(avgDealSize)) : '—'}
              valueClass="text-zinc-100"
            />
            <InsightCard
              label="Top Client"
              value={topClient ? topClient[0] : '—'}
              valueClass="text-amber-300"
              sub={topClient ? fmt(topClient[1]) : undefined}
            />
            <InsightCard
              label="Client Concentration"
              value={`${clientConcentration}%`}
              valueClass={clientConcentration > 60 ? 'text-amber-400' : 'text-zinc-100'}
              warn={clientConcentration > 60}
              sub="top 3 clients"
            />
            <InsightCard
              label="Pipeline Value"
              value={pipelineValue > 0 ? fmt(pipelineValue) : '£0'}
              valueClass="text-blue-400"
              sub={`${pipelineDeals.length} unsigned deal${pipelineDeals.length !== 1 ? 's' : ''}`}
            />
            <InsightCard
              label="Payment Health"
              value={invoicesTotal > 0 ? `${invoicesSent}/${invoicesTotal}` : '—'}
              valueClass="text-green-400"
              sub="invoices sent"
            />
            <InsightCard
              label="Currency Split"
              value={currencySplit || '—'}
              valueClass="text-zinc-300"
            />
            {data?.xero?.connected && (
              <>
                <InsightCard
                  label="Bank Balance"
                  value={typeof data.xero.bankBalance === 'number' ? `£${Math.abs(data.xero.bankBalance).toLocaleString('en-GB', { minimumFractionDigits: 0 })}` : '—'}
                  valueClass={(data.xero.bankBalance ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}
                  sub={data.xero.organisation ?? undefined}
                />
                <InsightCard
                  label="Net Profit YTD"
                  value={typeof data.xero.netProfit === 'number' ? `£${Math.abs(data.xero.netProfit).toLocaleString('en-GB', { minimumFractionDigits: 0 })}` : '—'}
                  valueClass={(data.xero.netProfit ?? 0) >= 0 ? 'text-[#D4A853]' : 'text-red-400'}
                  sub="from Xero"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* ---- Priority Reminders ---- */}
      {!loading && activeReminders.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest mb-3">
            Priority Reminders
          </h2>
          <div className="space-y-2">
            {visibleReminders.map((r, i) => {
              const originalIndex = reminders.indexOf(r)
              return (
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
                  <span className="text-sm text-zinc-300 flex-1">{r.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.dealId != null && (
                      <button
                        onClick={() => router.push(`/projects/${r.dealId}`)}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                      >
                        <ArrowRight className="h-3 w-3" />
                        Action
                      </button>
                    )}
                    <button
                      onClick={() => markDone(originalIndex)}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-500 hover:bg-green-900/50 hover:text-green-400 transition-colors"
                    >
                      <CheckSquare className="h-3 w-3" />
                      Done
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {activeReminders.length > 5 && (
            <button
              onClick={() => setShowAllReminders(!showAllReminders)}
              className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showAllReminders ? 'Show less' : `Show all ${activeReminders.length}`}
            </button>
          )}
        </div>
      )}

      {/* ---- Projects Grid ---- */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 h-32">
                <Skeleton className="h-4 w-2/3 mb-2" />
                <Skeleton className="h-3 w-1/2 mb-4" />
                <Skeleton className="h-6 w-1/3" />
              </div>
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-xs text-zinc-600">No projects</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {deals.map((deal, i) => (
              <ProjectCard
                key={deal.id ?? i}
                deal={deal}
                index={i}
                alerts={data?.billingAlerts ?? []}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
