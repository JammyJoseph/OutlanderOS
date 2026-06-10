'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { StatusBadge, ErrorBox, TabSkeleton, EmptyState, XeroDisconnectedBanner } from './FinanceBits'
import {
  useFinanceFetch,
  fmtGBP,
  fmtDate,
  daysUntil,
  INVOICE_STATUS_STYLES,
  SUBMISSION_STATUS_STYLES,
  type InvoicesResponse,
  type InvoiceSubmissionsResponse,
  type XeroInvoice,
  type InvoiceSubmission,
} from './finance-utils'

function receivableStatus(inv: XeroInvoice): string {
  if (inv.status === 'PAID') return 'PAID'
  const overdue = (() => {
    const d = daysUntil(inv.dueDate)
    return d !== null && d < 0
  })()
  if (overdue) return 'OVERDUE'
  if (inv.amountPaid > 0 && inv.amountDue > 0) return 'PARTIALLY PAID'
  return inv.status || 'SENT'
}

function Receivables({ res }: { res: ReturnType<typeof useFinanceFetch<InvoicesResponse>> }) {
  if (res.loading) return <div className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white" />
  if (res.error) return <ErrorBox message={`Failed to load invoices: ${res.error}`} />

  const data = res.data!
  if (!data.xeroConnected) {
    return <XeroDisconnectedBanner message="Xero is disconnected — client receivables are unavailable." />
  }
  const invoices = data.invoices ?? []
  if (invoices.length === 0) return <EmptyState message="No receivable invoices in Xero." />

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {['Client', 'Amount', 'Paid', 'Due', 'Date', 'Due Date', 'Status'].map((h) => (
              <th key={h} className={`px-3 py-2.5 font-medium text-gray-500 ${['Amount', 'Paid', 'Due'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {invoices.map((inv) => {
            const st = receivableStatus(inv)
            const overdue = st === 'OVERDUE'
            return (
              <tr key={inv.id} className={`transition-colors hover:bg-gray-50 ${overdue ? 'bg-red-50/40' : ''}`}>
                <td className="max-w-[180px] truncate px-3 py-2.5 font-medium text-gray-900">{inv.contact || '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtGBP(inv.amount, { decimals: true })}</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-600">{fmtGBP(inv.amountPaid, { decimals: true })}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtGBP(inv.amountDue, { decimals: true })}</td>
                <td className="px-3 py-2.5 text-gray-500">{fmtDate(inv.date)}</td>
                <td className={`px-3 py-2.5 ${overdue ? 'font-semibold text-red-500' : 'text-gray-500'}`}>{fmtDate(inv.dueDate)}</td>
                <td className="px-3 py-2.5"><StatusBadge status={st} map={INVOICE_STATUS_STYLES} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Payables({ res }: { res: ReturnType<typeof useFinanceFetch<InvoiceSubmissionsResponse>> }) {
  const [busy, setBusy] = useState<string | null>(null)

  async function update(id: string, status: string) {
    setBusy(id)
    try {
      await fetch(`/api/finance/invoice-submissions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      res.reload()
    } finally {
      setBusy(null)
    }
  }

  if (res.loading) return <div className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white" />
  if (res.error || res.data?.error) return <ErrorBox message={`Failed to load submissions: ${res.error ?? res.data?.error}`} />

  const submissions = res.data?.submissions ?? []
  if (submissions.length === 0) return <EmptyState message="No supplier invoice submissions." />

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {['Supplier', 'Amount', 'Status', 'Deadline', 'Days Left', 'Actions'].map((h) => (
              <th key={h} className={`px-3 py-2.5 font-medium text-gray-500 ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {submissions.map((s) => {
            const settled = s.status === 'PAID' || s.status === 'REJECTED'
            const days = daysUntil(s.paymentDeadline)
            const overdue = !settled && days !== null && days < 0
            const soon = !settled && days !== null && days >= 0 && days < 5
            const rowCls = overdue ? 'bg-red-50/50' : soon ? 'bg-amber-50/50' : ''
            return (
              <tr key={s.id} className={`transition-colors hover:bg-gray-50 ${rowCls}`}>
                <td className="px-3 py-2.5">
                  <p className="max-w-[180px] truncate font-medium text-gray-900">{s.supplierName}</p>
                  {s.description && <p className="max-w-[180px] truncate text-[10px] text-gray-400">{s.description}</p>}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-800">{s.amount != null ? fmtGBP(s.amount, { decimals: true }) : '—'}</td>
                <td className="px-3 py-2.5"><StatusBadge status={s.status} map={SUBMISSION_STATUS_STYLES} /></td>
                <td className="px-3 py-2.5 text-gray-500">{fmtDate(s.paymentDeadline)}</td>
                <td className={`px-3 py-2.5 font-mono ${overdue ? 'font-semibold text-red-500' : soon ? 'font-semibold text-amber-600' : 'text-gray-500'}`}>
                  {settled ? '—' : days === null ? '—' : overdue ? `${Math.abs(days)}d overdue` : `${days}d`}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(s.status === 'RECEIVED' || s.status === 'REVIEWED') && (
                      <button
                        onClick={() => update(s.id, 'REVIEWED')}
                        disabled={busy === s.id}
                        className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        Review
                      </button>
                    )}
                    {!settled && (
                      <button
                        onClick={() => update(s.id, 'PAID')}
                        disabled={busy === s.id}
                        className="rounded-md bg-[#D4A853] px-2 py-0.5 text-[10px] font-semibold text-gray-900 transition-colors hover:bg-[#C49843] disabled:opacity-50"
                      >
                        {busy === s.id ? '…' : 'Mark Paid'}
                      </button>
                    )}
                    {s.status === 'PAID' && <span className="text-[10px] font-medium text-emerald-600">Paid</span>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PaymentReminders({ submissions }: { submissions: InvoiceSubmission[] }) {
  const upcoming = submissions
    .filter((s) => {
      if (s.status === 'PAID' || s.status === 'REJECTED') return false
      const d = daysUntil(s.paymentDeadline)
      return d !== null && d >= 0 && d <= 7
    })
    .sort((a, b) => new Date(a.paymentDeadline).getTime() - new Date(b.paymentDeadline).getTime())

  if (upcoming.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
        <AlertTriangle className="h-3 w-3" /> Payment Deadlines This Week
      </p>
      <ul className="space-y-1">
        {upcoming.map((s) => {
          const days = daysUntil(s.paymentDeadline)
          return (
            <li key={s.id} className="flex items-center justify-between text-xs text-amber-900">
              <span className="truncate">{s.supplierName} — {s.amount != null ? fmtGBP(s.amount) : '—'}</span>
              <span className="ml-3 shrink-0 font-mono font-semibold">{days === 0 ? 'today' : `${days}d`}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function InvoicingTab() {
  const invoices = useFinanceFetch<InvoicesResponse>('/api/finance/invoices')
  const submissions = useFinanceFetch<InvoiceSubmissionsResponse>('/api/finance/invoice-submissions')

  if (invoices.loading && submissions.loading) return <TabSkeleton />

  return (
    <div className="space-y-6">
      <PaymentReminders submissions={submissions.data?.submissions ?? []} />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-800">Receivables — Client Invoices (Xero)</h2>
        <Receivables res={invoices} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-800">Payables — Supplier Invoice Submissions</h2>
        <Payables res={submissions} />
      </section>
    </div>
  )
}
