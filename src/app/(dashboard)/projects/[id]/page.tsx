'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
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

interface CrossRefStatus {
  client: string
  ioNumber?: string
  emailEvidence: {
    ioMentioned: boolean
    signedMentioned: boolean
    invoiceMentioned: boolean
    paymentMentioned: boolean
    lastEmailDate: string
    lastEmailSubject: string
    threadCount: number
  }
  xeroStatus: {
    hasInvoice: boolean
    invoicePaid: boolean
    amountInvoiced: number
    amountOutstanding: number
  }
  spreadsheetStatus: { signed: boolean; invoiceSent: boolean; annualTotal: string }
  flags: string[]
}

interface XeroInvoice {
  invoiceNumber: string
  contact: string
  status: string
  total: number
  amountDue: number
  dueDate: string
  fullyPaidOnDate?: string
}

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  billingAlerts?: BillingAlert[]
  billingTracker?: {
    bookedRevenue: string
    gapToTarget: string
    totalDeals: number
    deals: Deal[]
    allDeals?: Deal[]
    billingRows: string[][]
    invoicingRows: string[][]
    quarterlyTotals: { q1: number; q2: number; q3: number; q4: number }
    error?: string
  }
  xero?: {
    invoices?: XeroInvoice[]
  }
  crossReference?: CrossRefStatus[]
}

interface TimelineEvent {
  date: string
  description: string
  source: string
  color: string
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  modifiedTime: string
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
  if (isNaN(n)) return 'text-gray-500'
  if (n >= 50) return 'text-green-600'
  if (n >= 30) return 'text-amber-600'
  return 'text-red-500'
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

function FinanceCard({ label, value }: { label: string; value: string }) {
  const n = parseAmount(value)
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 min-w-0">
      <p className="text-gray-500 text-xs uppercase tracking-widest mb-1.5">{label}</p>
      <p className="font-mono text-lg font-bold text-gray-900 truncate">
        {n > 0 ? fmt(n) : value || '—'}
      </p>
    </div>
  )
}

function driveFileIcon(mimeType: string): string {
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('document') || mimeType.includes('word')) return '📄'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📑'
  if (mimeType.includes('pdf')) return '📋'
  return '📁'
}

function buildTimeline(
  deal: Deal,
  xeroInvoices: XeroInvoice[] | undefined,
  crossRef: CrossRefStatus | null
): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const clientLower = deal.client.toLowerCase()

  if (deal.dateBooked) {
    events.push({
      date: deal.dateBooked,
      description: 'Deal added to pipeline',
      source: 'Billing Tracker',
      color: 'bg-gray-400',
    })
  }

  if (deal.signed) {
    events.push({
      date: deal.dateBooked || '',
      description: 'IO Signed',
      source: 'Billing Tracker',
      color: 'bg-blue-500',
    })
  }

  if (deal.invoiceSent) {
    events.push({
      date: deal.dateBooked || '',
      description: 'Invoice Issued',
      source: 'Billing Tracker',
      color: 'bg-amber-400',
    })
  }

  if (xeroInvoices) {
    for (const inv of xeroInvoices) {
      const contact = (inv.contact || '').toLowerCase()
      const match = contact.includes(clientLower) || clientLower.includes(contact)
      if (!match) continue
      if (inv.status === 'PAID' && inv.fullyPaidOnDate) {
        events.push({
          date: inv.fullyPaidOnDate,
          description: `Payment Received — £${inv.total?.toLocaleString()}`,
          source: 'Xero',
          color: 'bg-green-500',
        })
      } else if (inv.dueDate) {
        events.push({
          date: inv.dueDate,
          description: `Invoice ${inv.invoiceNumber} — £${inv.amountDue?.toLocaleString()} outstanding`,
          source: 'Xero',
          color: 'bg-amber-500',
        })
      }
    }
  }

  if (crossRef?.emailEvidence?.lastEmailDate) {
    const subject = crossRef.emailEvidence.lastEmailSubject
    events.push({
      date: crossRef.emailEvidence.lastEmailDate,
      description: `Last email activity${subject ? ` — ${subject}` : ''}`,
      source: 'Gmail',
      color: 'bg-purple-500',
    })
  }

  // Sort by date descending (newest first), unknown dates go to top
  return events.sort((a, b) => {
    if (!a.date) return -1
    if (!b.date) return 1
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
}

function formatDate(d: string): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return d
  }
}

// ---- Performance Card ----

function PerformanceCard({ deal, xeroInvoices }: { deal: Deal; xeroInvoices?: XeroInvoice[] }) {
  const clientLower = deal.client.toLowerCase()
  const hasXeroData = xeroInvoices?.some(inv => {
    const contact = (inv.contact || '').toLowerCase()
    return contact.includes(clientLower) || clientLower.includes(contact)
  })

  if (!hasXeroData) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs text-gray-400">Performance score available when invoiced</p>
      </div>
    )
  }

  const marginPct = parseFloat((deal.margin || '0').replace('%', ''))
  const grade = marginPct > 20 ? 'A' : marginPct >= 10 ? 'B' : 'C'
  const gradeColor = grade === 'A' ? 'text-emerald-600' : grade === 'B' ? 'text-amber-600' : 'text-red-500'
  const gradeLabel = grade === 'A' ? 'Strong' : grade === 'B' ? 'Moderate' : 'Low'
  const gradeRange = grade === 'A' ? '>20% margin' : grade === 'B' ? '10–20% margin' : '<10% margin'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-5">
      <div className={`text-5xl font-bold font-mono leading-none ${gradeColor}`}>{grade}</div>
      <div>
        <p className="text-sm font-semibold text-gray-800">{gradeLabel} Performance</p>
        <p className="text-xs text-gray-500 mt-1">Margin: {deal.margin || '—'}</p>
        <p className="text-xs text-gray-500">Grade threshold: {gradeRange}</p>
      </div>
    </div>
  )
}

// ---- Task generation ----

function buildAllTasks(
  deal: Deal,
  alerts: BillingAlert[]
): Array<{ label: string; priority: 'red' | 'amber'; done: boolean }> {
  const tasks: Array<{ label: string; priority: 'red' | 'amber'; done: boolean }> = []
  if (!deal.signed) tasks.push({ label: 'Chase IO signature', priority: 'red', done: false })
  if (deal.signed && !deal.invoiceSent) tasks.push({ label: 'Send invoice', priority: 'amber', done: false })
  for (const alert of alerts) {
    const clientLower = deal.client.toLowerCase()
    const alertClient = (alert.client ?? '').toLowerCase()
    if (alertClient && (alertClient.includes(clientLower) || clientLower.includes(alertClient))) {
      tasks.push({
        label: alert.subject || 'Billing alert',
        priority: alert.priority === 'urgent' || alert.priority === 'high' ? 'red' : 'amber',
        done: false,
      })
    }
  }
  return tasks
}

// ---- Main Page ----

export default function ProjectDetailPage() {
  const params = useParams()
  const id = parseInt(params.id as string, 10)

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set())
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([])
  const [driveLoading, setDriveLoading] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard?crossref=true')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const bt = data?.billingTracker
  const allDeals = bt?.allDeals ?? bt?.deals ?? []
  const deal = allDeals[id]

  useEffect(() => {
    if (!deal) return
    setDriveLoading(true)
    const params = new URLSearchParams({ client: deal.client })
    if (deal.ioNumber) params.set('io', deal.ioNumber)
    fetch(`/api/drive/search?${params}`)
      .then((r) => r.json())
      .then((d) => setDriveFiles(d.files || []))
      .catch(() => setDriveFiles([]))
      .finally(() => setDriveLoading(false))
  }, [deal?.client, deal?.ioNumber])

  const SHEET_URL =
    'https://docs.google.com/spreadsheets/d/19v0t5A2Of3_-Pho1tuaWMgHAHzm-30ejrK88SNqaYHs'

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen max-w-4xl mx-auto">
        <Skeleton className="h-5 w-32 mb-6" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    )
  }

  // ---- Not found ----
  if (!deal) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-700 transition-colors mb-6 inline-block">
          ← Back to Dashboard
        </Link>
        <p className="text-gray-500">Project not found.</p>
      </div>
    )
  }

  const status = !deal.signed ? 'Pipeline' : !deal.invoiceSent ? 'Pending' : 'Active'
  const statusPill =
    status === 'Active' ? 'bg-green-100 text-green-700'
    : status === 'Pending' ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-100 text-gray-600'

  const tasks = buildAllTasks(deal, data?.billingAlerts ?? [])

  const bRow = deal.billingInfo ?? []
  const billingDetails = bRow.slice(3, 7).filter(Boolean)
  const paymentTerms = bRow[8] || ''
  const poNumber = bRow[1] || ''

  const clientLower = deal.client.toLowerCase()
  const crossRef = data?.crossReference?.find((cr) => {
    const c = (cr.client || '').toLowerCase()
    return c.includes(clientLower) || clientLower.includes(c)
  }) ?? null

  const timelineEvents = buildTimeline(deal, data?.xero?.invoices, crossRef)

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen max-w-4xl mx-auto">

      {/* Back */}
      <Link
        href="/"
        className="text-xs text-gray-500 hover:text-gray-700 transition-colors inline-flex items-center gap-1"
      >
        ← Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{deal.client}</h1>
          {deal.campaign && (
            <p className="text-gray-600 mt-1">{deal.campaign}</p>
          )}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusPill}`}>
              {status}
            </span>
            {deal.ioNumber && (
              <span className="font-mono text-xs text-gray-500">IO: {deal.ioNumber}</span>
            )}
            {deal.dateBooked && (
              <span className="text-xs text-gray-500">Booked: {deal.dateBooked}</span>
            )}
          </div>
        </div>
      </div>

      {/* Financial Cards */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Financials</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <FinanceCard label="Total Budget" value={deal.annualTotal} />
          <FinanceCard label="Q1" value={deal.q1} />
          <FinanceCard label="Q2" value={deal.q2} />
          <FinanceCard label="Q3" value={deal.q3} />
          <FinanceCard label="Q4" value={deal.q4} />
          <div className="bg-white border border-gray-200 rounded-xl p-4 min-w-0">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1.5">Margin</p>
            <p className={`font-mono text-lg font-bold ${deal.margin ? marginColor(deal.margin) : 'text-gray-400'}`}>
              {deal.margin || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Deal Timeline */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Deal Timeline</h2>
        {timelineEvents.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <p className="text-xs text-gray-400">No timeline events yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-5">
            <div className="space-y-4 border-l-2 border-gray-200 pl-4 ml-2">
              {timelineEvents.map((event, i) => (
                <div key={i} className="relative">
                  <div className={`absolute -left-[21px] w-3 h-3 rounded-full ${event.color}`} />
                  <div className="text-xs text-gray-500 font-mono">{formatDate(event.date)}</div>
                  <div className="text-sm text-gray-800">{event.description}</div>
                  <div className="text-xs text-gray-400">{event.source}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Billing Status */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Billing Status</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-5">
          <div>
            <p className="text-xs text-gray-500 mb-1">Signed</p>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${deal.signed ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={`text-sm font-medium ${deal.signed ? 'text-green-700' : 'text-red-600'}`}>
                {deal.signed ? 'Signed' : 'Unsigned'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Invoice</p>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${deal.invoiceSent ? 'bg-green-500' : 'bg-amber-400'}`} />
              <span className={`text-sm font-medium ${deal.invoiceSent ? 'text-green-700' : 'text-amber-700'}`}>
                {deal.invoiceSent ? 'Sent' : 'Not sent'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Payment Terms</p>
            <p className="text-sm text-gray-700 font-mono">{paymentTerms || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">PO Number</p>
            <p className="text-sm text-gray-700 font-mono">{poNumber || '—'}</p>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Outstanding Tasks
          {tasks.length > 0 && (
            <span className="ml-2 text-gray-400 normal-case font-normal">({tasks.length})</span>
          )}
        </h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {tasks.length === 0 ? (
            <div className="px-5 py-4">
              <p className="text-xs text-gray-400">No outstanding tasks</p>
            </div>
          ) : (
            tasks.map((task, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-5 py-3 ${i < tasks.length - 1 ? 'border-b border-gray-200' : ''} ${completedTasks.has(i) ? 'opacity-50' : ''}`}
              >
                <button
                  onClick={() =>
                    setCompletedTasks((prev) => {
                      const next = new Set(prev)
                      if (next.has(i)) next.delete(i)
                      else next.add(i)
                      return next
                    })
                  }
                  className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                    completedTasks.has(i)
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-gray-300 hover:border-gray-500'
                  }`}
                >
                  {completedTasks.has(i) && (
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 10 10">
                      <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.priority === 'red' ? 'bg-red-500' : 'bg-amber-400'}`}
                />
                <span className={`text-sm flex-1 ${completedTasks.has(i) ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {task.label}
                </span>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                    task.priority === 'red'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {task.priority === 'red' ? 'Urgent' : 'Action'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* IO Documents */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Documents</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {driveLoading ? (
            <div className="px-5 py-4">
              <p className="text-xs text-gray-400">Searching Drive…</p>
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="px-5 py-4">
              <p className="text-xs text-gray-400">No IO documents found in Drive</p>
            </div>
          ) : (
            driveFiles.map((file, i) => (
              <div
                key={file.id}
                className={`flex items-center gap-3 px-5 py-3 ${i < driveFiles.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="text-base shrink-0">{driveFileIcon(file.mimeType)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">
                    Modified {formatDate(file.modifiedTime)}
                  </p>
                </div>
                <a
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  Open in Drive ↗
                </a>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Billing Details */}
      {billingDetails.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Billing Details</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="space-y-1">
              {billingDetails.map((line, i) => (
                <p key={i} className="text-sm text-gray-700">{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Performance */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Performance</h2>
        <PerformanceCard deal={deal} xeroInvoices={data?.xero?.invoices} />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          onClick={() => alert('Send invoice reminder — placeholder')}
        >
          Send Invoice Reminder
        </button>
        <button
          className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          onClick={() => alert('Mark as paid — placeholder')}
        >
          Mark as Paid
        </button>
        <a
          href={SHEET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors inline-block"
        >
          View in Billing Tracker ↗
        </a>
      </div>
    </div>
  )
}
