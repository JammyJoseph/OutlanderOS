'use client'

import { useState } from 'react'
import { AlertTriangle, Flag, Plus, X } from 'lucide-react'
import { StatusBadge, ErrorBox, TabSkeleton, EmptyState, XeroDisconnectedBanner } from './FinanceBits'
import {
  useFinanceFetch,
  fmtGBP,
  fmtDate,
  daysUntil,
  displayStatus,
  SUBMISSION_STATUS_STYLES,
  type InvoicesResponse,
  type ProjectsResponse,
  type InvoiceSubmission,
} from './finance-utils'

interface AgedRow {
  contact: string
  total: number
  current: number
  period1: number
  period2: number
  period3: number
}

interface AgedResponse {
  xeroConnected: boolean
  xeroError: string | null
  rows: AgedRow[]
  total: number
  count: number
  error?: string
}

const inputCls = 'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-[#D4A853] focus:outline-none'

function AddInvoiceForm({ projects, onDone }: { projects: ProjectsResponse['projects']; onDone: () => void }) {
  const [supplierName, setSupplierName] = useState('')
  const [supplierEmail, setSupplierEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [project, setProject] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!supplierName.trim()) {
      setError('Supplier name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/finance/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: supplierName.trim(),
          supplierEmail: supplierEmail.trim(),
          amount: amount ? Number(amount) : null,
          description: description.trim() || null,
          campaignBudgetId: project || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      onDone()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#D4A853]/40 bg-amber-50/40 p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Log a Supplier Invoice</p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier name *" className={inputCls} />
        <input value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} placeholder="Supplier email" className={inputCls} />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (£)" type="number" min="0" step="0.01" className={`${inputCls} w-28`} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className={`${inputCls} min-w-[180px] flex-1`} />
        <select value={project} onChange={(e) => setProject(e.target.value)} className={inputCls}>
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.campaignName} — {p.clientName}</option>
          ))}
        </select>
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-gray-900 transition-colors hover:bg-[#C49843] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add Invoice'}
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}
    </div>
  )
}

interface OverageInfo {
  campaignName: string
  totalBudget: number
  currentCosts: number
  projectedCosts: number
  overBy: number
  status: string
}

function Incoming({
  res,
  projects,
}: {
  res: ReturnType<typeof useFinanceFetch<InvoicesResponse>>
  projects: ProjectsResponse['projects']
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [flagging, setFlagging] = useState<string | null>(null)
  const [flagNote, setFlagNote] = useState('')
  const [confirmOverage, setConfirmOverage] = useState<{ id: string; overage: OverageInfo } | null>(null)
  const [statusFilter, setStatusFilter] = useState('OPEN')

  const projectById = new Map(projects.map((p) => [p.id, p]))

  async function approve(id: string, confirmed = false) {
    setBusy(id)
    try {
      const r = await fetch(`/api/finance/invoices/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmed ? { confirmOverage: true } : {}),
      })
      if (r.status === 409) {
        const json = await r.json()
        setConfirmOverage({ id, overage: json.overage })
        return
      }
      setConfirmOverage(null)
      res.reload()
    } finally {
      setBusy(null)
    }
  }

  async function flag(id: string) {
    if (!flagNote.trim()) return
    setBusy(id)
    try {
      await fetch(`/api/finance/invoices/${id}/flag`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: flagNote.trim() }),
      })
      setFlagging(null)
      setFlagNote('')
      res.reload()
    } finally {
      setBusy(null)
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(id)
    try {
      await fetch(`/api/finance/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      res.reload()
    } finally {
      setBusy(null)
    }
  }

  if (res.loading) return <div className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white" />
  if (res.error || res.data?.error) return <ErrorBox message={`Failed to load invoices: ${res.error ?? res.data?.error}`} />

  const all = res.data?.invoices ?? []
  const invoices = all.filter((i) => {
    if (statusFilter === 'OPEN') return i.status !== 'PAID' && i.status !== 'REJECTED'
    if (statusFilter === 'ALL') return true
    return i.status === statusFilter
  })

  const filters = [
    { label: 'Open', value: 'OPEN' },
    { label: 'Received', value: 'RECEIVED' },
    { label: 'Under Review', value: 'UNDER_REVIEW' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Paid', value: 'PAID' },
    { label: 'All', value: 'ALL' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${statusFilter === f.value ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {confirmOverage && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4" /> This invoice pushes “{confirmOverage.overage.campaignName}” over budget
          </p>
          <p className="mb-3 text-[11px] text-red-600">
            Budget {fmtGBP(confirmOverage.overage.totalBudget)} · costs after approval {fmtGBP(confirmOverage.overage.projectedCosts)} ·{' '}
            <span className="font-semibold">{fmtGBP(confirmOverage.overage.overBy)} over</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => approve(confirmOverage.id, true)}
              className="rounded-lg bg-red-600 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-red-700"
            >
              Approve Anyway
            </button>
            <button
              onClick={() => setConfirmOverage(null)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <EmptyState message="No supplier invoices in this view." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Supplier', 'Amount', 'Project', 'Received', 'Deadline', 'Status', 'Actions'].map((h) => (
                  <th key={h} className={`px-3 py-2.5 font-medium text-gray-500 ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {invoices.map((inv) => {
                const settled = inv.status === 'PAID' || inv.status === 'REJECTED'
                const days = daysUntil(inv.paymentDeadline)
                const overdue = !settled && days !== null && days < 0
                const soon = !settled && days !== null && days >= 0 && days < 5
                const project = inv.campaignBudgetId ? projectById.get(inv.campaignBudgetId) : null
                const canApprove = inv.status === 'RECEIVED' || inv.status === 'UNDER_REVIEW' || inv.status === 'REVIEWED'
                return (
                  <tr key={inv.id} className={`transition-colors hover:bg-gray-50 ${overdue ? 'bg-red-50/50' : soon ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-3 py-2.5">
                      <p className="flex max-w-[200px] items-center gap-1.5 truncate font-medium text-gray-900">
                        {inv.flagged && <Flag className="h-3 w-3 shrink-0 text-red-500" />}
                        {inv.supplierName}
                      </p>
                      {inv.description && <p className="max-w-[200px] truncate text-[10px] text-gray-400">{inv.description}</p>}
                      {inv.flagged && inv.flagNote && <p className="max-w-[200px] truncate text-[10px] font-medium text-red-500">⚑ {inv.flagNote}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-800">{inv.amount != null ? fmtGBP(inv.amount, { decimals: true }) : '—'}</td>
                    <td className="max-w-[160px] truncate px-3 py-2.5 text-gray-500">{project ? project.campaignName : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-gray-500">{fmtDate(inv.receivedAt)}</td>
                    <td className="px-3 py-2.5">
                      <span className={overdue ? 'font-semibold text-red-500' : soon ? 'font-semibold text-amber-600' : 'text-gray-500'}>
                        {settled ? '—' : days === null ? fmtDate(inv.paymentDeadline) : overdue ? `${Math.abs(days)}d overdue` : `${days}d left`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={displayStatus(inv.status)} rawKey={inv.status} map={SUBMISSION_STATUS_STYLES} /></td>
                    <td className="px-3 py-2.5">
                      {flagging === inv.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            value={flagNote}
                            onChange={(e) => setFlagNote(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && flag(inv.id)}
                            placeholder="Why is this flagged?"
                            autoFocus
                            className="w-36 rounded-md border border-gray-200 px-2 py-0.5 text-[10px] focus:border-[#D4A853] focus:outline-none"
                          />
                          <button onClick={() => flag(inv.id)} disabled={busy === inv.id || !flagNote.trim()} className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50">
                            Flag
                          </button>
                          <button onClick={() => { setFlagging(null); setFlagNote('') }} className="text-gray-400 hover:text-gray-600">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canApprove && (
                            <button
                              onClick={() => approve(inv.id)}
                              disabled={busy === inv.id}
                              className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                          {!settled && !inv.flagged && (
                            <button
                              onClick={() => setFlagging(inv.id)}
                              disabled={busy === inv.id}
                              className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                            >
                              Flag
                            </button>
                          )}
                          {inv.status === 'APPROVED' && (
                            <button
                              onClick={() => setStatus(inv.id, 'PAID')}
                              disabled={busy === inv.id}
                              className="rounded-md bg-[#D4A853] px-2 py-0.5 text-[10px] font-semibold text-gray-900 transition-colors hover:bg-[#C49843] disabled:opacity-50"
                            >
                              Mark Paid
                            </button>
                          )}
                          {settled && <span className="text-[10px] text-gray-400">—</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Outgoing() {
  const res = useFinanceFetch<AgedResponse>('/api/finance/aged-receivables')

  if (res.loading) return <div className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white" />
  if (res.error || res.data?.error) return <ErrorBox message={`Failed to load receivables: ${res.error ?? res.data?.error}`} />

  const data = res.data!
  if (!data.xeroConnected) return <XeroDisconnectedBanner message="Xero is disconnected — outgoing client invoices are unavailable." />
  if (data.rows.length === 0) return <EmptyState message="No outstanding client invoices — everything is collected." />

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {['Client', 'Outstanding', 'Current', '1–30d Overdue', '31–60d', '60d+'].map((h, i) => (
              <th key={h} className={`px-3 py-2.5 font-medium text-gray-500 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data.rows.map((r) => (
            <tr key={r.contact} className="transition-colors hover:bg-gray-50">
              <td className="max-w-[200px] truncate px-3 py-2.5 font-medium text-gray-900">{r.contact || '—'}</td>
              <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">{fmtGBP(r.total, { decimals: true })}</td>
              <td className="px-3 py-2.5 text-right font-mono text-gray-500">{r.current > 0 ? fmtGBP(r.current, { decimals: true }) : '—'}</td>
              <td className={`px-3 py-2.5 text-right font-mono ${r.period1 > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{r.period1 > 0 ? fmtGBP(r.period1, { decimals: true }) : '—'}</td>
              <td className={`px-3 py-2.5 text-right font-mono ${r.period2 > 0 ? 'text-red-500' : 'text-gray-300'}`}>{r.period2 > 0 ? fmtGBP(r.period2, { decimals: true }) : '—'}</td>
              <td className={`px-3 py-2.5 text-right font-mono ${r.period3 > 0 ? 'font-semibold text-red-600' : 'text-gray-300'}`}>{r.period3 > 0 ? fmtGBP(r.period3, { decimals: true }) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td className="px-3 py-2.5 font-semibold text-gray-500">Total ({data.count})</td>
            <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900">{fmtGBP(data.total, { decimals: true })}</td>
            <td colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default function InvoicesApprovalsTab() {
  const [section, setSection] = useState<'incoming' | 'outgoing'>('incoming')
  const [showAdd, setShowAdd] = useState(false)
  const invoicesRes = useFinanceFetch<InvoicesResponse>('/api/finance/invoices')
  const projectsRes = useFinanceFetch<ProjectsResponse>('/api/finance/projects')
  const projects = projectsRes.data?.projects ?? []

  if (invoicesRes.loading && projectsRes.loading) return <TabSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(['incoming', 'outgoing'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${section === s ? 'bg-[#D4A853] text-gray-900' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {s === 'incoming' ? 'Incoming — Supplier Invoices' : 'Outgoing — Client Invoices'}
            </button>
          ))}
        </div>
        {section === 'incoming' && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAdd ? 'Close' : 'Log Invoice'}
          </button>
        )}
      </div>

      {section === 'incoming' ? (
        <>
          {showAdd && (
            <AddInvoiceForm
              projects={projects}
              onDone={() => {
                setShowAdd(false)
                invoicesRes.reload()
              }}
            />
          )}
          <Incoming res={invoicesRes} projects={projects} />
        </>
      ) : (
        <Outgoing />
      )}
    </div>
  )
}
