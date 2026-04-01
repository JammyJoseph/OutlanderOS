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

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  billingTracker?: BillingTracker
}

type Tab = 'deals' | 'billing' | 'invoicing' | 'summary' | 'expenses'

const TABS: { id: Tab; label: string }[] = [
  { id: 'deals', label: 'Deals' },
  { id: 'billing', label: 'Billing' },
  { id: 'invoicing', label: 'Invoicing' },
  { id: 'summary', label: 'Summary' },
  { id: 'expenses', label: 'Expenses' },
]

// ---- Xero types ----

interface XeroData {
  connected: boolean
  organisation?: string | null
  error?: string
  pnl?: { totalIncome: number; totalExpenses: number; netProfit: number } | null
  banks?: Array<{ name: string; balance: number }>
  invoices?: Array<{
    invoiceNumber?: string
    contact?: string
    total?: number
    amountDue?: number
    dueDate?: string
    status?: string
    currency?: string
  }>
  agedReceivables?: Array<{
    contact: string
    total: number
    current: number
    overdue30: number
    overdue60: number
    overdue90: number
  }>
}

// ---- Expenses Tab ----

function ExpensesTab() {
  const [xero, setXero] = useState<XeroData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/xero/data')
      .then(r => r.json())
      .then(setXero)
      .catch(() => setXero({ connected: false }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
      </div>
    )
  }

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
      <div className="rounded-xl border border-red-900/40 bg-red-900/10 px-6 py-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-400" />
        <p className="text-sm text-red-400 mb-4">Xero error: {xero.error}</p>
        <a
          href="/api/xero/connect"
          className="inline-block rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-[#C49843] transition-colors"
        >
          Reconnect Xero
        </a>
      </div>
    )
  }

  const fmt = (n?: number | null) =>
    typeof n === 'number' ? `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

  const statusColor = (s?: string) => {
    switch (s) {
      case 'PAID': return 'text-emerald-400'
      case 'AUTHORISED': return 'text-amber-400'
      case 'VOIDED': return 'text-zinc-600'
      default: return 'text-zinc-400'
    }
  }

  return (
    <div className="space-y-5">
      {/* Organisation */}
      {xero.organisation && (
        <p className="text-xs text-zinc-500">
          Connected to <span className="font-semibold text-zinc-300">{xero.organisation}</span>
        </p>
      )}

      {/* P&L KPIs */}
      {xero.pnl && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Total Income YTD</p>
            <p className="font-mono text-2xl font-bold text-emerald-400">{fmt(xero.pnl.totalIncome)}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Total Expenses YTD</p>
            <p className="font-mono text-2xl font-bold text-red-400">{fmt(xero.pnl.totalExpenses)}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Net Profit YTD</p>
            <p className={`font-mono text-2xl font-bold ${(xero.pnl.netProfit ?? 0) >= 0 ? 'text-[#D4A853]' : 'text-red-400'}`}>
              {fmt(xero.pnl.netProfit)}
            </p>
          </div>
        </div>
      )}

      {/* Bank Summary */}
      {xero.banks && xero.banks.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Bank Accounts</p>
          <div className="flex flex-wrap gap-3">
            {xero.banks.map((b, i) => (
              <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 min-w-[160px]">
                <p className="text-[10px] text-zinc-500 mb-1">{b.name}</p>
                <p className={"font-mono text-lg font-bold " + (b.balance >= 0 ? 'text-zinc-100' : 'text-red-400')}>
                  {fmt(b.balance)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Aged Receivables */}
      {xero.agedReceivables && xero.agedReceivables.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Aged Receivables</p>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-800">
                  <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Contact</th>
                  <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Current</th>
                  <th className="px-3 py-2.5 text-right font-medium text-zinc-500">1-30 days</th>
                  <th className="px-3 py-2.5 text-right font-medium text-zinc-500">31-60 days</th>
                  <th className="px-3 py-2.5 text-right font-medium text-zinc-500">60+ days</th>
                  <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-900">
                {xero.agedReceivables.map((ar, i) => (
                  <tr key={i} className="hover:bg-zinc-800/60 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-zinc-100">{ar.contact}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-zinc-400">{ar.current > 0 ? fmt(ar.current) : '—'}</td>
                    <td className={"px-3 py-2.5 text-right font-mono " + (ar.overdue30 > 0 ? 'text-amber-400' : 'text-zinc-600')}>{ar.overdue30 > 0 ? fmt(ar.overdue30) : '—'}</td>
                    <td className={"px-3 py-2.5 text-right font-mono " + (ar.overdue60 > 0 ? 'text-orange-400' : 'text-zinc-600')}>{ar.overdue60 > 0 ? fmt(ar.overdue60) : '—'}</td>
                    <td className={"px-3 py-2.5 text-right font-mono " + (ar.overdue90 > 0 ? 'text-red-400' : 'text-zinc-600')}>{ar.overdue90 > 0 ? fmt(ar.overdue90) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-zinc-200">{fmt(ar.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Invoices */}
      {xero.invoices && xero.invoices.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Recent Outgoing Invoices</p>
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

function parseNum(s: string): number {
  if (!s) return 0
  const cleaned = s.replace(/[£€$,\s]/g, '').replace('%', '')
  return parseFloat(cleaned) || 0
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
    <div className="flex flex-wrap gap-3">
      <div className="flex-1 min-w-[140px] rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Booked Revenue YTD</p>
        <p className="font-mono text-2xl font-bold text-emerald-400">{bt.bookedRevenue}</p>
      </div>
      <div className="flex-1 min-w-[120px] rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Gap to Target</p>
        <p className="font-mono text-2xl font-bold text-red-400">{bt.gapToTarget}</p>
      </div>
      <div className="flex-1 min-w-[100px] rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Total Deals</p>
        <p className="font-mono text-2xl font-bold text-white">{bt.totalDeals}</p>
      </div>
      <div className="flex-1 min-w-[130px] rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Signed / Unsigned</p>
        <p className="font-mono text-2xl font-bold">
          <span className="text-emerald-400">{bt.invoiceSummary.signed}</span>
          <span className="text-zinc-600 mx-1">/</span>
          <span className="text-amber-400">{bt.invoiceSummary.unsigned}</span>
        </p>
      </div>
      <div className="flex-1 min-w-[140px] rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Invoices Sent / Pending</p>
        <p className="font-mono text-2xl font-bold">
          <span className="text-emerald-400">{bt.invoiceSummary.invoicesSent}</span>
          <span className="text-zinc-600 mx-1">/</span>
          <span className="text-red-400">{bt.invoiceSummary.invoicesNotSent}</span>
        </p>
      </div>
    </div>
  )
}

// ---- Deals Tab ----

function DealsTab({ bt }: { bt: BillingTracker }) {
  const deals = bt.allDeals?.length ? bt.allDeals : bt.deals ?? []

  // Compute column totals
  const totals = deals.reduce((acc, d) => ({
    q1: acc.q1 + parseNum(d.q1),
    q2: acc.q2 + parseNum(d.q2),
    q3: acc.q3 + parseNum(d.q3),
    q4: acc.q4 + parseNum(d.q4),
    annual: acc.annual + parseNum(d.annualTotal),
  }), { q1: 0, q2: 0, q3: 0, q4: 0, annual: 0 })

  const fmt = (n: number) => n > 0 ? `£${n.toLocaleString('en-GB')}` : '—'

  return (
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
                <td className="px-3 py-2.5 font-medium text-zinc-100">{deal.client}</td>
                <td className="px-3 py-2.5 text-zinc-400 hidden lg:table-cell">{deal.campaign}</td>
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
  )
}

// ---- Billing Tab ----

function BillingTab({ bt }: { bt: BillingTracker }) {
  const rows = bt.billingRows ?? []
  const { signed, unsigned, invoicesSent, invoicesNotSent } = bt.invoiceSummary

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-12 text-center">
        <p className="text-sm text-zinc-500">No billing tracker rows available.</p>
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
              <th className="px-3 py-2.5 text-center font-medium text-zinc-500 w-12">Signed</th>
              <th className="px-3 py-2.5 text-left font-medium text-zinc-500">IO#</th>
              <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Brand</th>
              <th className="px-3 py-2.5 text-right font-medium text-zinc-500">Total</th>
              <th className="px-3 py-2.5 text-left font-medium text-zinc-500">Currency</th>
              <th className="px-3 py-2.5 text-right font-medium text-zinc-500">In GBP</th>
              <th className="px-3 py-2.5 text-center font-medium text-zinc-500 w-16">Invoice Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((row, i) => {
              const isSigned = row[0] === 'TRUE'
              const isInvoiced = row[7] === 'TRUE'
              const rowBg = isSigned && isInvoiced
                ? 'bg-emerald-950/30'
                : isSigned
                ? 'bg-amber-950/20'
                : 'bg-zinc-900'
              return (
                <tr key={i} className={`${rowBg} hover:brightness-110 transition-all`}>
                  <td className="px-3 py-2.5 text-center">
                    {isSigned
                      ? <span className="text-emerald-400 font-bold">✓</span>
                      : <span className="text-zinc-600">✗</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-zinc-400">{row[1] || '—'}</td>
                  <td className="px-3 py-2.5 font-medium text-zinc-100">{row[2] || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-zinc-200">{row[3] || '—'}</td>
                  <td className="px-3 py-2.5 text-zinc-400">{row[4] || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-zinc-200">{row[5] || '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    {isInvoiced
                      ? <span className="text-emerald-400 font-bold">✓</span>
                      : <span className="text-red-400">✗</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- Invoicing Tab ----

function InvoicingTab({ bt }: { bt: BillingTracker }) {
  const rows = bt.invoicingRows ?? []

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-12 text-center">
        <p className="text-sm text-zinc-500">No invoicing data available.</p>
      </div>
    )
  }

  const headers = rows[0] ?? []
  const dataRows = rows.slice(1)

  // Find "Paid" column index
  const paidColIdx = headers.findIndex(h =>
    typeof h === 'string' && h.toLowerCase().includes('paid')
  )

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-xs" style={{ minWidth: `${Math.max(headers.length * 100, 600)}px` }}>
        <thead>
          <tr className="bg-zinc-950 border-b border-zinc-800">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2.5 text-left font-medium text-zinc-500 whitespace-nowrap">
                {h || `Col ${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 bg-zinc-900">
          {dataRows.map((row, ri) => {
            const isPaid = paidColIdx >= 0 && row[paidColIdx] &&
              String(row[paidColIdx]).trim().length > 0 &&
              String(row[paidColIdx]).toLowerCase() !== 'false'
            return (
              <tr key={ri} className="hover:bg-zinc-800/60 transition-colors">
                {headers.map((_, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-2.5 whitespace-nowrap font-mono ${
                      ci === paidColIdx && isPaid
                        ? 'bg-emerald-900/40 text-emerald-300'
                        : 'text-zinc-300'
                    }`}
                  >
                    {row[ci] ?? ''}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---- Summary Tab ----

function SummaryTab({ bt }: { bt: BillingTracker }) {
  const deals = bt.allDeals?.length ? bt.allDeals : bt.deals ?? []

  const qtotals = deals.reduce((acc, d) => ({
    q1: acc.q1 + parseNum(d.q1),
    q2: acc.q2 + parseNum(d.q2),
    q3: acc.q3 + parseNum(d.q3),
    q4: acc.q4 + parseNum(d.q4),
  }), { q1: 0, q2: 0, q3: 0, q4: 0 })

  const fmt = (n: number) => n > 0 ? `£${n.toLocaleString('en-GB')}` : '£0'

  // Currency breakdown from billing rows
  const currencyCounts: Record<string, number> = {}
  for (const row of bt.billingRows ?? []) {
    const currency = (row[4] || 'GBP').trim().toUpperCase()
    if (currency) currencyCounts[currency] = (currencyCounts[currency] || 0) + 1
  }

  // Average margin from deals with a parseable margin
  const marginsWithValue = deals.map(d => parseNum(d.margin)).filter(m => m > 0)
  const avgMargin = marginsWithValue.length > 0
    ? marginsWithValue.reduce((a, b) => a + b, 0) / marginsWithValue.length
    : 0

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Revenue by Quarter</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => {
            const key = q.toLowerCase() as 'q1' | 'q2' | 'q3' | 'q4'
            return (
              <div key={q} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{q}</p>
                <p className="font-mono text-xl font-bold text-[#D4A853]">{fmt(qtotals[key])}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Currency Breakdown</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(currencyCounts).length === 0 ? (
            <p className="text-xs text-zinc-600">No billing data</p>
          ) : (
            Object.entries(currencyCounts).sort((a, b) => b[1] - a[1]).map(([currency, count]) => (
              <div key={currency} className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-3 text-center">
                <p className="font-mono text-lg font-bold text-zinc-100">{count}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{currency} deals</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Average Margin</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 inline-block px-6 py-4">
          <p className={`font-mono text-3xl font-bold ${marginColor(avgMargin.toFixed(1))}`}>
            {avgMargin > 0 ? `${avgMargin.toFixed(1)}%` : '—'}
          </p>
          <p className="text-[10px] text-zinc-500 mt-1">across {marginsWithValue.length} deals with margin data</p>
        </div>
      </section>
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

  const bt = data?.billingTracker

  return (
    <div className="flex flex-col gap-5 py-6 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">

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
          <ExpensesTab />
        ) : !bt ? (
          <p className="text-sm text-zinc-500">No billing data available.</p>
        ) : bt.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Failed to load billing tracker: {bt.error}
          </div>
        ) : (
          <>
            {activeTab === 'deals' && <DealsTab bt={bt} />}
            {activeTab === 'billing' && <BillingTab bt={bt} />}
            {activeTab === 'invoicing' && <InvoicingTab bt={bt} />}
            {activeTab === 'summary' && <SummaryTab bt={bt} />}
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
