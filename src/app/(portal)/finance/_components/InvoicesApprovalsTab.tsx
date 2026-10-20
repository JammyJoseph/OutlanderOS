'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, FileText, Flag, Plus, X } from 'lucide-react'
import { Avatar, KV, Panel, pill } from '@/components/os'
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

// Redesign board 6.2: the queue on the left, one invoice at a time on the
// right with its figure, details and the decision at the bottom.

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

const FIELD =
  'block h-11 w-full rounded-lg border border-field bg-card px-3.5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground focus:shadow-[0_0_0_3px_var(--focus)]'
const LABEL = 'mb-1.5 block text-sm text-ink-2'

function AddInvoiceForm({ projects, onDone, onCancel }: { projects: ProjectsResponse['projects']; onDone: () => void; onCancel: () => void }) {
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
    <Panel title="Log a supplier invoice">
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={LABEL}>Supplier name</span>
          <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required className={FIELD} />
        </label>
        <label>
          <span className={LABEL}>Supplier email</span>
          <input type="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} className={FIELD} />
        </label>
        <label>
          <span className={LABEL}>Amount (£)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" className={`${FIELD} tabular-nums`} />
        </label>
        <label>
          <span className={LABEL}>Project</span>
          <select value={project} onChange={(e) => setProject(e.target.value)} className={FIELD}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.campaignName} — {p.clientName}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={LABEL}>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={FIELD} />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-bad-bg px-4 py-3 text-[15px] text-bad">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button onClick={submit} disabled={saving} className={pill('primary')}>
          {saving ? 'Saving…' : 'Add invoice'}
        </button>
        <button onClick={onCancel} className={pill('ghost')}>
          Cancel
        </button>
      </div>
    </Panel>
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

const FILTERS = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Under review', value: 'UNDER_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Paid', value: 'PAID' },
  { label: 'All', value: 'ALL' },
]

function canApproveStatus(status: string) {
  return status === 'RECEIVED' || status === 'UNDER_REVIEW' || status === 'REVIEWED'
}

function dueLabel(inv: InvoiceSubmission): { text: string; tone: 'bad' | 'warn' | null } {
  const settled = inv.status === 'PAID' || inv.status === 'REJECTED'
  if (settled) return { text: fmtDate(inv.paymentDeadline), tone: null }
  const days = daysUntil(inv.paymentDeadline)
  if (days === null) return { text: fmtDate(inv.paymentDeadline), tone: null }
  if (days < 0) return { text: `${fmtDate(inv.paymentDeadline)} · ${Math.abs(days)} days overdue`, tone: 'bad' }
  if (days < 5) return { text: `${fmtDate(inv.paymentDeadline)} · ${days} day${days === 1 ? '' : 's'} left`, tone: 'warn' }
  return { text: `${fmtDate(inv.paymentDeadline)} · ${days} days`, tone: null }
}

function Incoming({
  res,
  projects,
  initialId,
}: {
  res: ReturnType<typeof useFinanceFetch<InvoicesResponse>>
  projects: ProjectsResponse['projects']
  initialId: string | null
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [flagging, setFlagging] = useState<string | null>(null)
  const [flagNote, setFlagNote] = useState('')
  const [confirmOverage, setConfirmOverage] = useState<{ id: string; overage: OverageInfo } | null>(null)
  const [statusFilter, setStatusFilter] = useState('OPEN')
  const [selectedId, setSelectedId] = useState<string | null>(initialId)

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

  if (res.loading) return <div className="h-64 animate-pulse rounded-2xl bg-surface" />
  if (res.error || res.data?.error) return <ErrorBox message={`Failed to load invoices: ${res.error ?? res.data?.error}`} />

  const all = res.data?.invoices ?? []
  const invoices = all.filter((i) => {
    if (statusFilter === 'OPEN') return i.status !== 'PAID' && i.status !== 'REJECTED'
    if (statusFilter === 'ALL') return true
    if (statusFilter === 'UNDER_REVIEW') return i.status === 'UNDER_REVIEW' || i.status === 'REVIEWED'
    return i.status === statusFilter
  })
  // A deep link to an invoice outside the current filter still opens it.
  const inv = all.find((i) => i.id === selectedId) ?? invoices[0] ?? null
  const toApprove = all.filter((i) => canApproveStatus(i.status)).length

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label="Filter invoices" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            aria-pressed={statusFilter === f.value}
            className={`min-h-9 rounded-full px-4 text-sm font-medium transition-colors ${
              statusFilter === f.value ? 'bg-foreground text-background' : 'bg-surface text-ink-2 hover:bg-surface-2 hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {invoices.length === 0 && !inv ? (
        <EmptyState message="No supplier invoices in this view." />
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
          <nav aria-label="Invoice queue" className="flex flex-col gap-1">
            <h2 className="mb-2 px-1 text-xl font-semibold">
              {statusFilter === 'OPEN' ? `To approve · ${toApprove}` : `${FILTERS.find((f) => f.value === statusFilter)?.label} · ${invoices.length}`}
            </h2>
            {invoices.map((i) => {
              const on = inv?.id === i.id
              const project = i.campaignBudgetId ? projectById.get(i.campaignBudgetId) : null
              const due = dueLabel(i)
              return (
                <button
                  key={i.id}
                  onClick={() => {
                    setSelectedId(i.id)
                    setFlagging(null)
                    setConfirmOverage(null)
                  }}
                  aria-current={on ? 'true' : undefined}
                  className={`flex flex-col gap-0.5 rounded-2xl px-4 py-3.5 text-left transition-colors ${on ? 'bg-secondary' : 'hover:bg-surface'}`}
                >
                  <span className="flex items-baseline justify-between gap-3 font-semibold">
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      {i.flagged && <Flag className="size-3.5 shrink-0 text-bad" aria-label="Flagged" />}
                      {i.supplierName}
                    </span>
                    <span className="shrink-0 tabular-nums">{i.amount != null ? fmtGBP(i.amount) : '—'}</span>
                  </span>
                  <span className={`truncate text-sm ${due.tone === 'bad' ? 'text-bad' : 'text-muted-foreground'}`}>
                    {[project?.campaignName, displayStatus(i.status)].filter(Boolean).join(' · ')}
                  </span>
                </button>
              )
            })}
            {invoices.length === 0 && <p className="px-1 text-[15px] text-muted-foreground">Nothing in this view.</p>}
          </nav>

          {inv && (
            <InvoiceDetail
              key={inv.id}
              inv={inv}
              project={inv.campaignBudgetId ? projectById.get(inv.campaignBudgetId) ?? null : null}
              busy={busy === inv.id}
              flagging={flagging === inv.id}
              flagNote={flagNote}
              setFlagNote={setFlagNote}
              onStartFlag={() => setFlagging(inv.id)}
              onCancelFlag={() => {
                setFlagging(null)
                setFlagNote('')
              }}
              onFlag={() => flag(inv.id)}
              onApprove={() => approve(inv.id)}
              onMarkPaid={() => setStatus(inv.id, 'PAID')}
              overage={confirmOverage?.id === inv.id ? confirmOverage.overage : null}
              onApproveAnyway={() => approve(inv.id, true)}
              onCancelOverage={() => setConfirmOverage(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function InvoiceDetail({
  inv,
  project,
  busy,
  flagging,
  flagNote,
  setFlagNote,
  onStartFlag,
  onCancelFlag,
  onFlag,
  onApprove,
  onMarkPaid,
  overage,
  onApproveAnyway,
  onCancelOverage,
}: {
  inv: InvoiceSubmission
  project: ProjectsResponse['projects'][number] | null
  busy: boolean
  flagging: boolean
  flagNote: string
  setFlagNote: (v: string) => void
  onStartFlag: () => void
  onCancelFlag: () => void
  onFlag: () => void
  onApprove: () => void
  onMarkPaid: () => void
  overage: OverageInfo | null
  onApproveAnyway: () => void
  onCancelOverage: () => void
}) {
  const settled = inv.status === 'PAID' || inv.status === 'REJECTED'
  const canApprove = canApproveStatus(inv.status)
  const due = dueLabel(inv)

  return (
    <article aria-label={`Invoice from ${inv.supplierName}`} className="flex min-w-0 flex-col gap-6">
      <section className="flex flex-col items-start gap-3">
        <Avatar name={inv.supplierName} size={56} />
        <div className="text-[36px] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-[44px]">
          {inv.amount != null ? fmtGBP(inv.amount, { decimals: true }) : '—'}
        </div>
        <p className="text-base text-ink-2">
          To <strong className="font-semibold text-foreground">{inv.supplierName}</strong>
          {inv.emailSubject ? ` · ${inv.emailSubject}` : ''}
        </p>
        <StatusBadge status={canApprove ? 'Waiting for your approval' : displayStatus(inv.status)} rawKey={inv.status} map={SUBMISSION_STATUS_STYLES} />
      </section>

      {inv.flagged && inv.flagNote && (
        <div className="flex items-start gap-3 rounded-2xl bg-warn-bg px-5 py-4 text-warn">
          <Flag className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-semibold">Flagged</div>
            <div className="text-[15px]">{inv.flagNote}</div>
          </div>
        </div>
      )}

      {overage && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-bad-bg px-5 py-4 text-bad">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-semibold">This pushes &ldquo;{overage.campaignName}&rdquo; over budget</div>
              <div className="text-[15px]">
                Budget {fmtGBP(overage.totalBudget)} · costs after approval {fmtGBP(overage.projectedCosts)} ·{' '}
                <strong>{fmtGBP(overage.overBy)} over</strong>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onApproveAnyway} disabled={busy} className={pill('danger', 'sm')}>
              Approve anyway
            </button>
            <button onClick={onCancelOverage} className={pill('ghost', 'sm')}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <Panel title="Details" bodyClassName="[&>*+*]:border-t [&>*+*]:border-line">
        <KV
          k="Project"
          v={
            project ? (
              <Link href={`/finance?tab=projects&project=${project.id}`} className="underline decoration-line underline-offset-4 hover:decoration-foreground">
                {project.campaignName}
              </Link>
            ) : (
              '—'
            )
          }
        />
        {inv.description && <KV k="Description" v={inv.description} />}
        <KV k="Received" v={fmtDate(inv.receivedAt)} />
        <KV k="Payment due" v={<span className={due.tone === 'bad' ? 'text-bad' : due.tone === 'warn' ? 'text-warn' : ''}>{due.text}</span>} />
        {inv.supplierEmail && <KV k="Supplier email" v={inv.supplierEmail} />}
        {inv.approvedAt && <KV k="Approved" v={`${fmtDate(inv.approvedAt)}${inv.approvedBy ? ` · ${inv.approvedBy}` : ''}`} />}
        {inv.paidAt && <KV k="Paid" v={fmtDate(inv.paidAt)} />}
        {inv.notes && <KV k="Notes" v={inv.notes} />}
        {inv.attachmentUrl && (
          <a
            href={inv.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 py-3 font-semibold underline decoration-line underline-offset-4 hover:decoration-foreground"
          >
            <FileText className="size-5 shrink-0" /> Open the invoice file
          </a>
        )}
      </Panel>

      {flagging ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface px-5 py-4">
          <label htmlFor={`flag-${inv.id}`} className="text-[15px] font-semibold">
            Why is this flagged?
          </label>
          <input
            id={`flag-${inv.id}`}
            value={flagNote}
            onChange={(e) => setFlagNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onFlag()}
            autoFocus
            className={FIELD}
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={onFlag} disabled={busy || !flagNote.trim()} className={pill('danger', 'sm')}>
              <Flag /> Flag invoice
            </button>
            <button onClick={onCancelFlag} className={pill('ghost', 'sm')}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        !settled && (
          <div className="flex flex-wrap gap-2.5">
            {canApprove && (
              <button onClick={onApprove} disabled={busy} className={`${pill('primary')} flex-[1_1_220px]`}>
                Approve
              </button>
            )}
            {inv.status === 'APPROVED' && (
              <button onClick={onMarkPaid} disabled={busy} className={`${pill('primary')} flex-[1_1_220px]`}>
                Mark paid
              </button>
            )}
            {!inv.flagged && (
              <button onClick={onStartFlag} disabled={busy} className={pill('danger')}>
                <Flag /> Flag
              </button>
            )}
          </div>
        )
      )}
    </article>
  )
}

function Outgoing() {
  const res = useFinanceFetch<AgedResponse>('/api/finance/aged-receivables')

  if (res.loading) return <div className="h-64 animate-pulse rounded-2xl bg-surface" />
  if (res.error || res.data?.error) return <ErrorBox message={`Failed to load receivables: ${res.error ?? res.data?.error}`} />

  const data = res.data!
  if (!data.xeroConnected) return <XeroDisconnectedBanner message="Xero is disconnected — outgoing client invoices are unavailable." />
  if (data.rows.length === 0) return <EmptyState message="No outstanding client invoices — everything is collected." />

  const cell = (n: number, tone: string) =>
    n > 0 ? <span className={tone}>{fmtGBP(n, { decimals: true })}</span> : <span className="text-muted-foreground">—</span>

  return (
    <Panel title="Owed to us, by age">
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[640px] text-[15px]">
          <thead>
            <tr className="border-b border-line">
              {['Client', 'Outstanding', 'Current', '1–30 days', '31–60 days', '60+ days'].map((h, i) => (
                <th key={h} className={`px-2 pb-3 text-[13px] font-medium text-muted-foreground ${i === 0 ? 'text-left' : 'text-right'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr+tr]:border-t [&>tr+tr]:border-line">
            {data.rows.map((r) => (
              <tr key={r.contact}>
                <td className="max-w-[220px] truncate px-2 py-3.5 font-semibold">{r.contact || '—'}</td>
                <td className="px-2 py-3.5 text-right font-semibold tabular-nums">{fmtGBP(r.total, { decimals: true })}</td>
                <td className="px-2 py-3.5 text-right tabular-nums">{cell(r.current, '')}</td>
                <td className="px-2 py-3.5 text-right tabular-nums">{cell(r.period1, 'text-warn')}</td>
                <td className="px-2 py-3.5 text-right tabular-nums">{cell(r.period2, 'text-bad')}</td>
                <td className="px-2 py-3.5 text-right tabular-nums">{cell(r.period3, 'font-semibold text-bad')}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line">
              <td className="px-2 pt-4 font-semibold">Total · {data.count}</td>
              <td className="px-2 pt-4 text-right font-semibold tabular-nums">{fmtGBP(data.total, { decimals: true })}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  )
}

export default function InvoicesApprovalsTab() {
  const params = useSearchParams()
  const [section, setSection] = useState<'incoming' | 'outgoing'>(params.get('section') === 'outgoing' ? 'outgoing' : 'incoming')
  const [showAdd, setShowAdd] = useState(false)
  const invoicesRes = useFinanceFetch<InvoicesResponse>('/api/finance/invoices')
  const projectsRes = useFinanceFetch<ProjectsResponse>('/api/finance/projects')
  const projects = projectsRes.data?.projects ?? []

  if (invoicesRes.loading && projectsRes.loading) return <TabSkeleton />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Invoice direction" className="flex gap-1 rounded-full bg-surface p-1">
          {(['incoming', 'outgoing'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              aria-pressed={section === s}
              className={`min-h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
                section === s ? 'bg-background text-foreground shadow-[0_1px_2px_rgba(11,18,32,0.08)]' : 'text-ink-2 hover:text-foreground'
              }`}
            >
              {s === 'incoming' ? 'Supplier invoices' : 'Client invoices'}
            </button>
          ))}
        </div>
        {section === 'incoming' && (
          <button onClick={() => setShowAdd((v) => !v)} className={pill('secondary', 'sm')}>
            {showAdd ? <X /> : <Plus />}
            {showAdd ? 'Close' : 'Log invoice'}
          </button>
        )}
      </div>

      {section === 'incoming' ? (
        <>
          {showAdd && (
            <AddInvoiceForm
              projects={projects}
              onCancel={() => setShowAdd(false)}
              onDone={() => {
                setShowAdd(false)
                invoicesRes.reload()
              }}
            />
          )}
          <Incoming res={invoicesRes} projects={projects} initialId={params.get('invoice')} />
        </>
      ) : (
        <Outgoing />
      )}
    </div>
  )
}
