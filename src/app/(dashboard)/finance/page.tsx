'use client'

import { useEffect, useState, Suspense } from 'react'
import { Loader2, RefreshCw, AlertCircle, TrendingUp, Link2 } from 'lucide-react'

interface Deal {
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
  billingRows?: string[][]
  invoicingRows?: string[][]
  error?: string
}

interface XeroData {
  connected: boolean
  organisation?: string
  error?: string
  totalIncome?: number
  totalExpenses?: number
  netProfit?: number
  bankBalance?: number
  invoices?: Array<{
    invoiceNumber?: string
    contact?: string
    total?: number
    amountDue?: number
    dueDate?: string
    status?: string
    type?: string
  }>
}

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  billingTracker?: BillingTracker
  xero?: XeroData
}

type Tab = 'deals' | 'billing' | 'expenses'

const TABS: { id: Tab; label: string }[] = [
  { id: 'deals', label: 'Deals' },
  { id: 'billing', label: 'Billing' },
  { id: 'expenses', label: 'Expenses' },
]

// ---- Helpers ----

function parseNum(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/[£€$,\s]/g, '').replace('%', '')) || 0
}

function marginColor(margin: string): string {
  const pct = parseNum(margin)
  if (pct > 20) return 'text-emerald-400'
  if (pct >= 10) return 'text-amber-400'
  return 'text-red-400'
}

function isZeroTotal(annualTotal: string): boolean {
  return parseNum(annualTotal) === 0
}

// ---- Stats Bar ----

function StatsBar({ bt }: { bt: BillingTracker }) {
  return (
    <div className="flex flex-wrap gap-2">
      <div className="flex-1 min-w-0 min-w-[130px] rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-500 mb-1 truncate">Booked Revenue YTD</p>
        <p className="font-mono text-lg sm:text-xl lg:text-2xl font-bold text-emerald-400 truncate">{bt.bookedRevenue}</p>
      </div>
      <div className="flex-1 min-w-0 min-w-[110px] rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-500 mb-1 truncate">Gap to Target</p>
        <p className="font-mono text-lg sm:text-xl lg:text-2xl font-bold text-red-400 truncate">{bt.gapToTarget}</p>
      </div>
      <div className="flex-1 min-w-0 min-w-[90px] rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-500 mb-1 truncate">Total Deals</p>
        <p className="font-mono text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">{bt.totalDeals}</p>
      </div>
      <div className="flex-1 min-w-0 min-w-[120px] rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-500 mb-1 truncate">Signed / Unsigned</p>
        <p className="font-mono text-lg sm:text-xl lg:text-2xl font-bold">
          <span className="text-emerald-400">{bt.invoiceSummary.signed}</span>
          <span className="text-zinc-600 mx-1">/</span>
          <span className="text-amber-400">{bt.invoiceSummary.unsigned}</span>
        </p>
      </div>
      <div className="flex-1 min-w-0 min-w-[130px] rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-500 mb-1 truncate">Invoices Sent / Pending</p>
        <p className="font-mono text-lg sm:text-xl lg:text-2xl font-bold">
          <span className="text-emerald-400">{bt.invoiceSummary.invoicesSent}</span>
          <span className="text-zinc-600 mx-1">/</span>
          <span className="text-red-400">{bt.invoiceSummary.invoicesNotSent}</span>
        </p>
      </div>
    </div>
  )
}

// ---- Expenses Tab ----

function ExpensesTab({ xero }: { xero?: XeroData }) {
  if (!xero?.connected) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-sm font-bold text-zinc-400">
          X
        </div>
        <h3 className="mb-1 text-sm font-semibold text-zinc-200">Connect Xero</h3>
        <p className="mb-5 text-xs text-zinc-500">Connect your Xero account to see P&amp;L, bank balances, and recent invoices.</p>
        <a
          href="/api/xero/connect"
          className="inline-block rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-[#C49843] transition-colors"
        >
          <Link2 className="mr-1.5 inline h-3.5 w-3.5" />
          Connect Xero
        </a>
      </div>
    )
  }

  if (xero.error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/10 px-4 py-3 text-sm text-red-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Xero error: {xero.error}
      </div>
    )
  }

  const fmt = (n?: number | null) =>
    typeof n === 'number' ? `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

  const statusColor = (s?: string) => {
    switch (s) {
      case 'PAID': return 'text-emerald-400'
      case 'AUTHORISED': return 'text-amber-400'
      case 'OVERDUE': return 'text-red-400'
      case 'VOIDED': return 'text-zinc-600'
      default: return 'text-zinc-400'
    }
  }

  return (
    <div className="space-y-5">
      {xero.organisation && (
        <p className="text-xs text-zinc-500">
          Connected to <span className="font-semibold text-zinc-300">{xero.organisation}</span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Total Income YTD</p>
          <p className="font-mono text-xl font-bold text-emerald-400 truncate">{fmt(xero.totalIncome)}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Total Expenses YTD</p>
          <p className="font-mono text-xl font-bold text-red-400 truncate">{fmt(xero.totalExpenses)}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Net Profit YTD</p>
          <p className={`font-mono text-xl font-bold truncate ${(xero.netProfit ?? 0) >= 0 ? 'text-[#D4A853]' : 'text-red-400'}`}>
            {fmt(xero.netProfit)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Bank Balance</p>
          <p className={`font-mono text-xl font-bold truncate ${(xero.bankBalance ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(xero.bankBalance)}
          </p>
        </div>
      </div>

      {xero.invoices && xero.invoices.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Invoices (Authorised / Overdue)</p>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-800">
                  <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Invoice #</th>
                  <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Contact</th>
                  <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Total</th>
                  <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Amount Due</th>
                  <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Due Date</th>
                  <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-900">
                {xero.invoices.map((inv, i) => (
                  <tr key={i} className="hover:bg-zinc-800/60 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-zinc-400">{inv.invoiceNumber ?? '—'}</td>
                    <td className="px-3 py-2.5 text-zinc-100">{inv.contact ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-zinc-200">{fmt(inv.total)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-zinc-200">{fmt(inv.amountDue)}</td>
                    <td className="px-3 py-2.5 text-zinc-400">{inv.dueDate ?? '—'}</td>
                    <td className={`px-3 py-2.5 font-semibold ${statusColor(inv.status)}`}>{inv.status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Deals Tab ----

function DealsTab({ bt, xero }: { bt: BillingTracker; xero?: XeroData }) {
  const deals = bt.allDeals?.length ? bt.allDeals : bt.deals ?? []

  const totals = deals.reduce((acc, d) => ({
    q1: acc.q1 + parseNum(d.q1),
    q2: acc.q2 + parseNum(d.q2),
    q3: acc.q3 + parseNum(d.q3),
    q4: acc.q4 + parseNum(d.q4),
    annual: acc.annual + parseNum(d.annualTotal),
  }), { q1: 0, q2: 0, q3: 0, q4: 0, annual: 0 })

  const fmt = (n: number) => n > 0 ? `£${n.toLocaleString('en-GB')}` : '—'
  const fmtXero = (n?: number | null) =>
    typeof n === 'number' ? `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'

  return (
    <div className="space-y-5">
      {/* Xero P&L summary — the TRUE numbers */}
      {xero?.connected && !xero.error && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Xero — Real Accounting Data
            {xero.organisation && <span className="ml-2 text-zinc-600 normal-case">({xero.organisation})</span>}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Total Income YTD</p>
              <p className="font-mono text-base font-bold text-emerald-400 truncate">{fmtXero(xero.totalIncome)}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Total Expenses YTD</p>
              <p className="font-mono text-base font-bold text-red-400 truncate">{fmtXero(xero.totalExpenses)}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Net Profit YTD</p>
              <p className={`font-mono text-base font-bold truncate ${(xero.netProfit ?? 0) >= 0 ? 'text-[#D4A853]' : 'text-red-400'}`}>
                {fmtXero(xero.netProfit)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Bank Balance</p>
              <p className={`font-mono text-base font-bold truncate ${(xero.bankBalance ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtXero(xero.bankBalance)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Tracker */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Campaign Tracker — Pipeline &amp; Booked Deals</p>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="px-3 py-2.5 text-left font-medium text-zinc-500">IO#</th>
                <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Client</th>
                <th className="px-3 py-2.5 text-left font-medium text-zinc-500 hidden lg:table-cell">Campaign</th>
                <th className="px-3 py-2.5 text-left font-medium text-zinc-500 hidden xl:table-cell">Date Booked</th>
                <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Q1</th>
                <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Q2</th>
                <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Q3</th>
                <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Q4</th>
                <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Annual Total</th>
                <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Margin%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-900">
              {deals.map((deal, i) => {
                const zero = isZeroTotal(deal.annualTotal)
                return (
                  <tr key={i} className={`hover:bg-zinc-800/60 transition-colors ${zero ? 'opacity-35' : ''}`}>
                    <td className="px-3 py-2.5 font-mono text-zinc-400">{deal.ioNumber || '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-zinc-100 truncate max-w-[120px]">{deal.client}</td>
                    <td className="px-3 py-2.5 text-zinc-400 hidden lg:table-cell truncate max-w-[160px]">{deal.campaign}</td>
                    <td className="px-3 py-2.5 text-zinc-500 hidden xl:table-cell">{deal.dateBooked}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-zinc-300">{deal.q1 || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-zinc-300">{deal.q2 || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-zinc-300">{deal.q3 || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-zinc-300">{deal.q4 || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-zinc-100 font-semibold">{deal.annualTotal || '—'}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${marginColor(deal.margin)}`}>{deal.margin || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-950 border-t-2 border-zinc-700">
                <td className="px-3 py-2.5 text-zinc-500 font-semibold" colSpan={4}>Totals</td>
                <td className="px-3 py-2.5 text-right font-mono text-zinc-200 font-semibold">{fmt(totals.q1)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-zinc-200 font-semibold">{fmt(totals.q2)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-zinc-200 font-semibold">{fmt(totals.q3)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-zinc-200 font-semibold">{fmt(totals.q4)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[#D4A853] font-bold">{fmt(totals.annual)}</td>
                <td className="px-3 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---- Billing Tab ----

interface BillingRow {
  client: string
  ioNumber: string
  amount: string
  currency: string
  signed: boolean
  invoiceSent: boolean
  status: 'Paid' | 'Invoice Sent' | 'Pending' | 'Pipeline'
}

function deriveBillingRows(bt: BillingTracker): BillingRow[] {
  // Build a map of IO# -> deal info from allDeals
  const dealMap: Record<string, Deal> = {}
  const deals = bt.allDeals?.length ? bt.allDeals : bt.deals ?? []
  for (const d of deals) {
    if (d.ioNumber) dealMap[d.ioNumber.trim()] = d
  }

  const billingRows = bt.billingRows ?? []

  // If no billing rows, fall back to deals
  if (billingRows.length === 0) {
    return deals.map((d) => {
      const signed = !!(d as unknown as { signed?: boolean }).signed
      const invoiceSent = !!(d as unknown as { invoiceSent?: boolean }).invoiceSent
      let status: BillingRow['status'] = 'Pipeline'
      if (signed && invoiceSent) status = 'Invoice Sent'
      else if (signed) status = 'Pending'
      else status = 'Pipeline'
      return {
        client: d.client,
        ioNumber: d.ioNumber,
        amount: d.annualTotal,
        currency: 'GBP',
        signed,
        invoiceSent,
        status,
      }
    })
  }

  return billingRows.map((row) => {
    const signed = row[0] === 'TRUE'
    const ioNumber = row[1] || ''
    const brand = row[2] || ''
    const total = row[3] || ''
    const currency = row[4] || 'GBP'
    const inGbp = row[5] || total
    const invoiceSent = row[7] === 'TRUE'

    // Try to match deal for paid status
    const deal = dealMap[ioNumber.trim()]
    const isPaid = deal
      ? !!(deal as unknown as { paid?: boolean }).paid
      : false

    let status: BillingRow['status']
    if (isPaid) status = 'Paid'
    else if (signed && invoiceSent) status = 'Invoice Sent'
    else if (signed) status = 'Pending'
    else status = 'Pipeline'

    return {
      client: brand,
      ioNumber,
      amount: inGbp || total,
      currency,
      signed,
      invoiceSent,
      status,
    }
  })
}

function statusBadge(status: BillingRow['status']) {
  switch (status) {
    case 'Paid':
      return <span className="inline-flex items-center rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Paid</span>
    case 'Invoice Sent':
      return <span className="inline-flex items-center rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-400">Invoice Sent</span>
    case 'Pending':
      return <span className="inline-flex items-center rounded-full bg-red-900/40 px-2 py-0.5 text-[10px] font-semibold text-red-400">Pending</span>
    case 'Pipeline':
      return <span className="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">Pipeline</span>
  }
}

function BillingTab({ bt }: { bt: BillingTracker }) {
  const rows = deriveBillingRows(bt)
  const { signed, unsigned, invoicesSent, invoicesNotSent } = bt.invoiceSummary

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-12 text-center">
        <p className="text-sm text-zinc-500">No billing data available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        <span className="text-emerald-400 font-semibold">{signed} signed</span>
        <span className="text-zinc-600">, </span>
        <span className="text-amber-400 font-semibold">{unsigned} unsigned</span>
        <span className="text-zinc-600"> — </span>
        <span className="text-emerald-400 font-semibold">{invoicesSent} invoices sent</span>
        <span className="text-zinc-600">, </span>
        <span className="text-red-400 font-semibold">{invoicesNotSent} pending</span>
      </p>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-950 border-b border-zinc-800">
              <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Client</th>
              <th className="px-3 py-2.5 text-left font-medium text-zinc-500">IO#</th>
              <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Amount (£)</th>
              <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Currency</th>
              <th className="px-3 py-2.5 text-center font-medium text-zinc-500 w-14">Signed</th>
              <th className="px-3 py-2.5 text-center font-medium text-zinc-500 w-20">Invoice Sent</th>
              <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-900">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-zinc-800/60 transition-colors">
                <td className="px-3 py-2.5 font-medium text-zinc-100 truncate max-w-[140px]">{row.client || '—'}</td>
                <td className="px-3 py-2.5 font-mono text-zinc-400">{row.ioNumber || '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono text-zinc-200">{row.amount || '—'}</td>
                <td className="px-3 py-2.5 text-zinc-400">{row.currency || 'GBP'}</td>
                <td className="px-3 py-2.5 text-center">
                  {row.signed
                    ? <span className="text-emerald-400 font-bold">✓</span>
                    : <span className="text-zinc-600">✗</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {row.invoiceSent
                    ? <span className="text-emerald-400 font-bold">✓</span>
                    : <span className="text-red-400">✗</span>}
                </td>
                <td className="px-3 py-2.5">{statusBadge(row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- Page ----

function FinancePageInner() {
  const [activeTab, setActiveTab] = useState<Tab>('deals')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
      setSecondsAgo(0)
      setError(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 30000)
    return () => clearInterval(interval)
  }, [])

  // Tick seconds-ago counter
  useEffect(() => {
    if (!lastUpdated) return
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [lastUpdated])

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

  const bt = data?.billingTracker

  return (
    <div className="flex flex-col gap-5 py-6 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white">Finance</h1>
            <p className="text-xs text-zinc-500 mt-0.5">2026 Master Billing Tracker</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {lastUpdated && (
              <span className="text-[10px] text-zinc-600 hidden sm:block">
                Updated {secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}
              </span>
            )}
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {bt && !bt.error && <StatsBar bt={bt} />}

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
        {activeTab === 'expenses' ? (
          <ExpensesTab xero={data?.xero} />
        ) : !bt ? (
          <p className="text-sm text-zinc-500">No billing data available.</p>
        ) : bt.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Failed to load billing tracker: {bt.error}
          </div>
        ) : (
          <>
            {activeTab === 'deals' && <DealsTab bt={bt} xero={data?.xero} />}
            {activeTab === 'billing' && <BillingTab bt={bt} />}
          </>
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
