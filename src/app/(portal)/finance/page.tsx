'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, RefreshCw, AlertCircle, TrendingUp, Link2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

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
  contacts?: Array<{
    contactId?: string
    name?: string
    email?: string
    phone?: string
    outstandingBalance?: number
    overdueBalance?: number
  }>
  recentPayments?: Array<{
    date?: string
    contact?: string
    total?: number
    reference?: string
    status?: string
    type?: string
  }>
  agedReceivablesRaw?: unknown
}

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  billingTracker?: BillingTracker
  xero?: XeroData
}

type Tab = 'deals' | 'billing' | 'expenses' | 'cashflow'

const TABS: { id: Tab; label: string }[] = [
  { id: 'deals', label: 'Deals' },
  { id: 'billing', label: 'Billing' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'cashflow', label: 'Cash Flow' },
]

function parseNum(s: string): number {
  if (!s) return 0
  return parseFloat(s.replace(/[£€$,\s]/g, '').replace('%', '')) || 0
}

function marginColor(margin: string): string {
  const pct = parseNum(margin)
  if (pct > 20) return 'text-emerald-600'
  if (pct >= 10) return 'text-amber-600'
  return 'text-red-500'
}

function isZeroTotal(annualTotal: string): boolean {
  return parseNum(annualTotal) === 0
}

function SkeletonBar() {
  return (
    <div className="flex flex-wrap gap-2">
      {[140, 120, 100, 130, 150].map((w, i) => (
        <div key={i} className={`flex-1 min-w-[${w}px] rounded-lg border border-gray-200 bg-white px-4 py-3 animate-pulse`}>
          <div className="h-2 w-20 rounded bg-gray-200 mb-2" />
          <div className="h-6 w-24 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  )
}

function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 animate-pulse">
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2.5">
        <div className="h-3 w-48 rounded bg-gray-200" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-3 py-2.5 border-b border-gray-100">
          <div className="h-3 w-12 rounded bg-gray-100" />
          <div className="h-3 w-24 rounded bg-gray-100" />
          <div className="h-3 flex-1 rounded bg-gray-100" />
          <div className="h-3 w-16 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}

function StatsBar({ bt }: { bt: BillingTracker }) {
  return (
    <div className="flex flex-wrap gap-2">
      <div className="flex-1 min-w-[130px] rounded-lg border border-gray-200 bg-white px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 truncate">Booked Revenue YTD</p>
        <p className="font-mono text-xl font-bold text-emerald-600 truncate">{bt.bookedRevenue}</p>
      </div>
      <div className="flex-1 min-w-[110px] rounded-lg border border-gray-200 bg-white px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 truncate">Gap to Target</p>
        <p className="font-mono text-xl font-bold text-red-500 truncate">{bt.gapToTarget}</p>
      </div>
      <div className="flex-1 min-w-[90px] rounded-lg border border-gray-200 bg-white px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 truncate">Total Deals</p>
        <p className="font-mono text-xl font-bold text-gray-900 truncate">{bt.totalDeals}</p>
      </div>
      <div className="flex-1 min-w-[120px] rounded-lg border border-gray-200 bg-white px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 truncate">Signed / Unsigned</p>
        <p className="font-mono text-xl font-bold">
          <span className="text-emerald-600">{bt.invoiceSummary.signed}</span>
          <span className="text-gray-300 mx-1">/</span>
          <span className="text-amber-600">{bt.invoiceSummary.unsigned}</span>
        </p>
      </div>
      <div className="flex-1 min-w-[130px] rounded-lg border border-gray-200 bg-white px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 truncate">Invoices Sent / Pending</p>
        <p className="font-mono text-xl font-bold">
          <span className="text-emerald-600">{bt.invoiceSummary.invoicesSent}</span>
          <span className="text-gray-300 mx-1">/</span>
          <span className="text-red-500">{bt.invoiceSummary.invoicesNotSent}</span>
        </p>
      </div>
    </div>
  )
}

function ExpensesTab({ xero }: { xero?: XeroData }) {
  if (!xero?.connected) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-500">X</div>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">Connect Xero</h3>
        <p className="mb-5 text-xs text-gray-500">Connect your Xero account to see P&amp;L, bank balances, and recent invoices.</p>
        <a href="/api/xero/connect" className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-[#C49843] transition-colors">
          <Link2 className="h-3.5 w-3.5" />
          Connect Xero
        </a>
      </div>
    )
  }

  if (xero.error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Xero error: {xero.error}
      </div>
    )
  }

  const fmt = (n?: number | null) =>
    typeof n === 'number' ? `£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

  const statusColor = (s?: string) => {
    switch (s) {
      case 'PAID': return 'text-emerald-600'
      case 'AUTHORISED': return 'text-amber-600'
      case 'OVERDUE': return 'text-red-500'
      case 'VOIDED': return 'text-gray-400'
      default: return 'text-gray-500'
    }
  }

  return (
    <div className="space-y-5">
      {xero.organisation && (
        <p className="text-xs text-gray-500">Connected to <span className="font-semibold text-gray-800">{xero.organisation}</span></p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Income YTD', val: xero.totalIncome, cls: 'text-emerald-600' },
          { label: 'Total Expenses YTD', val: xero.totalExpenses, cls: 'text-red-500' },
          { label: 'Net Profit YTD', val: xero.netProfit, cls: (xero.netProfit ?? 0) >= 0 ? 'text-[#D4A853]' : 'text-red-500' },
          { label: 'Bank Balance', val: xero.bankBalance, cls: (xero.bankBalance ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500' },
        ].map(({ label, val, cls }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</p>
            <p className={`font-mono text-xl font-bold truncate ${cls}`}>{fmt(val)}</p>
          </div>
        ))}
      </div>

      {xero.invoices && xero.invoices.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Invoices (Authorised / Overdue)</p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Invoice #', 'Contact', 'Total', 'Amount Due', 'Due Date', 'Status'].map(h => (
                    <th key={h} className={`px-3 py-2.5 text-left font-medium text-gray-500 ${['Total', 'Amount Due'].includes(h) ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {xero.invoices.map((inv, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-gray-500">{inv.invoiceNumber ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-900">{inv.contact ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmt(inv.total)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmt(inv.amountDue)}</td>
                    <td className="px-3 py-2.5 text-gray-500">{inv.dueDate ?? '—'}</td>
                    <td className={`px-3 py-2.5 font-semibold ${statusColor(inv.status)}`}>{inv.status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {xero.contacts && xero.contacts.some(c => (c.outstandingBalance ?? 0) > 0 || (c.overdueBalance ?? 0) > 0) && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Client Balances</p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500">Client</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500">Outstanding</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {xero.contacts
                  .filter(c => (c.outstandingBalance ?? 0) > 0 || (c.overdueBalance ?? 0) > 0)
                  .sort((a, b) => (b.overdueBalance ?? 0) - (a.overdueBalance ?? 0))
                  .map((c, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 text-gray-900 truncate max-w-[200px]">{c.name ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-600">{fmt(c.outstandingBalance)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono font-semibold ${(c.overdueBalance ?? 0) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {(c.overdueBalance ?? 0) > 0 ? fmt(c.overdueBalance) : '—'}
                      </td>
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
      {xero?.connected && !xero.error && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Xero — Real Accounting Data
            {xero.organisation && <span className="ml-2 text-gray-400 normal-case">({xero.organisation})</span>}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Total Income YTD', val: xero.totalIncome, cls: 'text-emerald-600' },
              { label: 'Total Expenses YTD', val: xero.totalExpenses, cls: 'text-red-500' },
              { label: 'Net Profit YTD', val: xero.netProfit, cls: (xero.netProfit ?? 0) >= 0 ? 'text-[#D4A853]' : 'text-red-500' },
              { label: 'Bank Balance', val: xero.bankBalance, cls: (xero.bankBalance ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500' },
            ].map(({ label, val, cls }) => (
              <div key={label} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</p>
                <p className={`font-mono text-base font-bold truncate ${cls}`}>{fmtXero(val)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Campaign Tracker — Pipeline &amp; Booked Deals</p>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['IO#', 'Client', 'Campaign', 'Date', 'Q1', 'Q2', 'Q3', 'Q4', 'Annual', 'Margin%'].map((h) => (
                  <th key={h} className={`px-3 py-2.5 font-medium text-gray-500 ${['Q1','Q2','Q3','Q4','Annual','Margin%'].includes(h) ? 'text-right' : 'text-left'} ${['Campaign','Date'].includes(h) ? 'hidden lg:table-cell' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {deals.map((deal, i) => (
                <tr key={i} className={`hover:bg-gray-50 transition-colors ${isZeroTotal(deal.annualTotal) ? 'opacity-35' : ''}`}>
                  <td className="px-3 py-2.5 font-mono text-gray-500">{deal.ioNumber || '—'}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-900 truncate max-w-[120px]">{deal.client}</td>
                  <td className="px-3 py-2.5 text-gray-500 hidden lg:table-cell truncate max-w-[160px]">{deal.campaign}</td>
                  <td className="px-3 py-2.5 text-gray-400 hidden lg:table-cell">{deal.dateBooked}</td>
                  {[deal.q1, deal.q2, deal.q3, deal.q4].map((q, qi) => (
                    <td key={qi} className="px-3 py-2.5 text-right font-mono text-gray-700">{q || '—'}</td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">{deal.annualTotal || '—'}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${marginColor(deal.margin)}`}>{deal.margin || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td className="px-3 py-2.5 font-semibold text-gray-500" colSpan={4}>Totals</td>
                {[totals.q1, totals.q2, totals.q3, totals.q4].map((t, i) => (
                  <td key={i} className="px-3 py-2.5 text-right font-mono font-semibold text-gray-800">{fmt(t)}</td>
                ))}
                <td className="px-3 py-2.5 text-right font-mono font-bold text-[#D4A853]">{fmt(totals.annual)}</td>
                <td className="px-3 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

type LineStatus = 'Paid' | 'Invoice Sent' | 'Overdue' | 'Chasing' | 'Pending'

interface BillingRow {
  client: string
  ioNumber: string
  amount: string
  currency: string
  signed: boolean
  invoiceSent: boolean
  status: LineStatus
}

function deriveLineStatus(
  signed: boolean,
  invoiceSent: boolean,
  xeroInvoices?: XeroData['invoices'],
  clientName?: string
): LineStatus {
  if (!signed) return 'Pending'

  if (xeroInvoices && clientName) {
    const clientLower = clientName.toLowerCase()
    const match = xeroInvoices.find(inv =>
      (inv.contact ?? '').toLowerCase().includes(clientLower) ||
      clientLower.includes((inv.contact ?? '').toLowerCase())
    )
    if (match) {
      if (match.status === 'PAID') return 'Paid'
      if (match.status === 'OVERDUE') return 'Overdue'
    }
  }

  if (invoiceSent) return 'Invoice Sent'
  return 'Pending'
}

function deriveBillingRows(bt: BillingTracker, xero?: XeroData): BillingRow[] {
  const deals = bt.allDeals?.length ? bt.allDeals : bt.deals ?? []
  const billingRows = bt.billingRows ?? []

  if (billingRows.length === 0) {
    return deals.map((d) => {
      const signed = !!(d as unknown as { signed?: boolean }).signed
      const invoiceSent = !!(d as unknown as { invoiceSent?: boolean }).invoiceSent
      const status = deriveLineStatus(signed, invoiceSent, xero?.invoices, d.client)
      return { client: d.client, ioNumber: d.ioNumber, amount: d.annualTotal, currency: 'GBP', signed, invoiceSent, status }
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
    const status = deriveLineStatus(signed, invoiceSent, xero?.invoices, brand)
    return { client: brand, ioNumber, amount: inGbp || total, currency, signed, invoiceSent, status }
  })
}

const STATUS_BADGE: Record<LineStatus, string> = {
  Paid: 'bg-emerald-100 text-emerald-700',
  'Invoice Sent': 'bg-amber-100 text-amber-700',
  Overdue: 'bg-red-100 text-red-700',
  Chasing: 'bg-orange-100 text-orange-700',
  Pending: 'bg-gray-100 text-gray-500',
}

function StatusBadge({ status }: { status: LineStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[status]}`}>
      {status}
    </span>
  )
}

function RemindQuinnButton({ client, ioNumber }: { client: string; ioNumber: string }) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function remind() {
    setSending(true)
    try {
      await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Reminder: Invoice overdue for ${client}${ioNumber ? ` (IO# ${ioNumber})` : ''}. Please chase payment.` }),
      })
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  if (sent) return <span className="text-[10px] text-emerald-600 font-medium">Sent</span>

  return (
    <button
      onClick={remind}
      disabled={sending}
      className="ml-2 inline-flex items-center rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50"
    >
      {sending ? '…' : 'Remind Quinn'}
    </button>
  )
}

function BillingTab({ bt, xero }: { bt: BillingTracker; xero?: XeroData }) {
  const rows = deriveBillingRows(bt, xero)
  const { signed, unsigned, invoicesSent, invoicesNotSent } = bt.invoiceSummary

  if (rows.length === 0) {
    return <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center"><p className="text-sm text-gray-500">No billing data available.</p></div>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        <span className="text-emerald-600 font-semibold">{signed} signed</span>, <span className="text-amber-600 font-semibold">{unsigned} unsigned</span>
        {' — '}<span className="text-emerald-600 font-semibold">{invoicesSent} invoices sent</span>, <span className="text-red-500 font-semibold">{invoicesNotSent} pending</span>
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Client', 'IO#', 'Amount (£)', 'Currency', 'Signed', 'Invoice Sent', 'Status'].map(h => (
                <th key={h} className={`px-3 py-2.5 font-medium text-gray-500 ${h === 'Amount (£)' ? 'text-right' : 'text-left'} ${['Signed','Invoice Sent'].includes(h) ? 'text-center w-20' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 font-medium text-gray-900 truncate max-w-[140px]">{row.client || '—'}</td>
                <td className="px-3 py-2.5 font-mono text-gray-500">{row.ioNumber || '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-800">{row.amount || '—'}</td>
                <td className="px-3 py-2.5 text-gray-500">{row.currency || 'GBP'}</td>
                <td className="px-3 py-2.5 text-center">{row.signed ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-gray-400">✗</span>}</td>
                <td className="px-3 py-2.5 text-center">{row.invoiceSent ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-red-500">✗</span>}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1 flex-wrap">
                    <StatusBadge status={row.status} />
                    {row.status === 'Overdue' && (
                      <RemindQuinnButton client={row.client} ioNumber={row.ioNumber} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CashFlowTab({ xero, bt }: { xero?: XeroData; bt?: BillingTracker }) {
  const today = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) }
  })

  const monthMap: Record<string, { confirmed: number; projected: number }> = {}
  for (const m of months) monthMap[m.key] = { confirmed: 0, projected: 0 }

  if (xero?.invoices) {
    for (const inv of xero.invoices) {
      if (!inv.dueDate || !inv.amountDue || inv.status === 'PAID') continue
      const d = new Date(inv.dueDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthMap[key]) monthMap[key].confirmed += inv.amountDue
    }
  }

  const deals = bt?.allDeals ?? bt?.deals ?? []
  const xeroContacts = new Set((xero?.invoices ?? []).map(i => (i.contact || '').toLowerCase()))

  for (const deal of deals) {
    if (!(deal as unknown as { signed?: boolean }).signed) continue
    const clientLower = deal.client.toLowerCase()
    const hasXero = [...xeroContacts].some(c => c.includes(clientLower) || clientLower.includes(c))
    if (hasXero) continue
    const qValues: Record<string, string> = { q1: deal.q1, q2: deal.q2, q3: deal.q3, q4: deal.q4 }
    const qMonthNums: Record<string, string[]> = { q1: ['01','02','03'], q2: ['04','05','06'], q3: ['07','08','09'], q4: ['10','11','12'] }
    for (const [q, mNums] of Object.entries(qMonthNums)) {
      const monthly = parseNum(qValues[q]) / 3
      if (!monthly) continue
      for (const mn of mNums) {
        const key = `${today.getFullYear()}-${mn}`
        if (monthMap[key]) monthMap[key].projected += monthly
      }
    }
  }

  const chartData = months.map(m => ({ month: m.label, confirmed: Math.round(monthMap[m.key].confirmed), projected: Math.round(monthMap[m.key].projected) }))
  const totalConfirmed = Object.values(monthMap).reduce((s, m) => s + m.confirmed, 0)
  const totalProjected = Object.values(monthMap).reduce((s, m) => s + m.projected, 0)
  const total = totalConfirmed + totalProjected
  const fmtCash = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Expected (6mo)', val: total, cls: 'text-gray-900' },
          { label: 'Confirmed', val: totalConfirmed, cls: 'text-blue-600' },
          { label: 'Projected', val: totalProjected, cls: 'text-amber-500' },
          { label: 'Current Bank Balance', val: xero?.bankBalance ?? null, cls: (xero?.bankBalance ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500', custom: xero?.bankBalance != null ? fmtCash(xero.bankBalance) : '—' },
        ].map(({ label, val, cls, custom }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</p>
            <p className={`font-mono text-xl font-bold truncate ${cls}`}>{custom ?? (val !== null ? fmtCash(val as number) : '—')}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-gray-500">6-Month Cash Flow Projection</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => [`£${Number(v ?? 0).toLocaleString('en-GB')}`, '']} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="confirmed" name="Confirmed (Xero)" fill="#3b82f6" stackId="a" />
            <Bar dataKey="projected" name="Projected (Pipeline)" fill="#f59e0b" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function FinancePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = (searchParams.get('tab') as Tab) || 'deals'

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
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

  useEffect(() => {
    if (!lastUpdated) return
    const tick = setInterval(() => setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000)), 1000)
    return () => clearInterval(tick)
  }, [lastUpdated])

  function switchTab(tab: Tab) {
    router.push(`/finance?tab=${tab}`)
  }

  if (error && !data) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-500" />
          <p className="text-sm text-gray-700">{error}</p>
          <button onClick={() => load()} className="mt-4 rounded-lg bg-gray-100 px-4 py-2 text-xs text-gray-700 hover:bg-gray-200 transition-colors">Retry</button>
        </div>
      </div>
    )
  }

  if (!loading && !data?.connected.primary) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <TrendingUp className="mx-auto mb-3 h-6 w-6 text-gray-400" />
          <p className="text-sm font-medium text-gray-600">Primary account not connected</p>
          <p className="mt-1 text-xs text-gray-400">Connect operations@outlandermag.com to access the billing tracker.</p>
          <a href="/api/google/connect?label=primary" className="mt-4 inline-block rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-medium text-gray-900 hover:bg-[#C49843] transition-colors">Connect</a>
        </div>
      </div>
    )
  }

  const bt = data?.billingTracker

  return (
    <div className="flex flex-col gap-5 py-6 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Finance</h1>
            <p className="text-xs text-gray-500 mt-0.5">2026 Master Billing Tracker</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {lastUpdated && <span className="text-[10px] text-gray-400 hidden sm:block">Updated {secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}</span>}
            <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50">
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading ? <SkeletonBar /> : bt && !bt.error ? <StatsBar bt={bt} /> : null}

        <div className="flex border-b border-gray-200">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => switchTab(tab.id)} className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab.id ? 'border-[#D4A853] text-[#D4A853]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonTable rows={8} />
        ) : activeTab === 'expenses' ? <ExpensesTab xero={data?.xero} />
          : activeTab === 'cashflow' ? <CashFlowTab xero={data?.xero} bt={data?.billingTracker} />
          : !bt ? <p className="text-sm text-gray-500">No billing data available.</p>
          : bt.error ? <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />Failed to load billing tracker: {bt.error}</div>
          : activeTab === 'deals' ? <DealsTab bt={bt} xero={data?.xero} />
          : <BillingTab bt={bt} xero={data?.xero} />
        }
      </div>
    </div>
  )
}

export default function FinancePage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>}>
      <FinancePageInner />
    </Suspense>
  )
}
