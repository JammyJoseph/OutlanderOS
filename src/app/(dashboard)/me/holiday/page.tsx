'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field } from '@/components/ui/Field'
import { INPUT_CLS } from '@/lib/styles'
import { Avatar, FlowFrame, FlowTitle, KV, Overlay, Page, PageHead, Panel, Row, Rows, SectionHead, Split, StatGrid, SuccessScreen, Table, Tag, pill } from '@/components/os'

type HolidayStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
type HolidayType = 'ANNUAL' | 'SICK' | 'PERSONAL' | 'OTHER'

type HolidayRequest = {
  id: string
  userId: string
  startDate: string
  endDate: string
  days: number
  type: HolidayType
  notes: string | null
  status: HolidayStatus
  approvedBy: string | null
  createdAt: string
  user?: { id: string; name: string; email: string; department: string | null; avatarUrl: string | null; avatar: string | null }
}

type Balance = { allowance: number; used: number; pending: number; remaining: number; year: number }
type Me = { id: string; role: 'ADMIN' | 'MEMBER'; name: string }

function formatRange(startISO: string, endISO: string): string {
  const start = new Date(startISO)
  const end = new Date(endISO)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: start.getFullYear() === end.getFullYear() ? undefined : 'numeric' })
  if (start.toDateString() === end.toDateString()) return fmt(start)
  return `${fmt(start)} – ${fmt(end)}`
}

function todayISO(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function bookedDatesMap(requests: HolidayRequest[]): Map<string, HolidayStatus> {
  const map = new Map<string, HolidayStatus>()
  for (const r of requests) {
    if (r.status !== 'APPROVED' && r.status !== 'PENDING') continue
    const cur = new Date(r.startDate)
    const end = new Date(r.endDate)
    cur.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10)
      const existing = map.get(key)
      if (!existing || (existing === 'PENDING' && r.status === 'APPROVED')) map.set(key, r.status)
      cur.setDate(cur.getDate() + 1)
    }
  }
  return map
}

// Working days between two dates, inclusive — what the server will charge.
function workingDays(startISO: string, endISO: string): number {
  if (!startISO || !endISO) return 0
  const cur = new Date(startISO)
  const end = new Date(endISO)
  if (end < cur) return 0
  let n = 0
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) n++
    cur.setDate(cur.getDate() + 1)
  }
  return n
}

const TYPES: { value: HolidayType; title: string; text: string }[] = [
  { value: 'ANNUAL', title: 'Holiday', text: 'Comes out of your allowance' },
  { value: 'SICK', title: 'Sick', text: "Doesn't use your allowance" },
  { value: 'PERSONAL', title: 'Personal', text: 'Appointments, family, moving house' },
  { value: 'OTHER', title: 'Other', text: 'Anything else — add a note' },
]

type Step = 'closed' | 'dates' | 'review' | 'sent'

export default function HolidayPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [balance, setBalance] = useState<Balance | null>(null)
  const [requests, setRequests] = useState<HolidayRequest[]>([])
  const [teamApproved, setTeamApproved] = useState<HolidayRequest[]>([])
  const [pendingTeam, setPendingTeam] = useState<HolidayRequest[]>([])
  const [loading, setLoading] = useState(true)

  const [step, setStep] = useState<Step>('closed')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    startDate: todayISO(7),
    endDate: todayISO(7),
    type: 'ANNUAL' as HolidayType,
    notes: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<{ id: string; status: HolidayStatus; who?: string } | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [meJson, balJson, reqJson, teamJson] = await Promise.all([
        fetch('/api/me').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/holiday/balance').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/holiday').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/holiday?all=true&status=APPROVED').then((r) => (r.ok ? r.json() : [])),
      ])
      const meUser = meJson?.user
      setMe(meUser ? { id: meUser.id, role: meUser.role, name: meUser.name } : null)
      setBalance(balJson)
      setRequests(Array.isArray(reqJson) ? reqJson : [])
      setTeamApproved(Array.isArray(teamJson) ? teamJson : [])

      if (meUser?.role === 'ADMIN') {
        const teamRes = await fetch('/api/holiday?all=true&status=PENDING').then((r) => (r.ok ? r.json() : []))
        setPendingTeam(Array.isArray(teamRes) ? teamRes : [])
      } else {
        setPendingTeam([])
      }
    } finally {
      setLoading(false)
    }
  }

  function toReview() {
    setError(null)
    if (!form.startDate || !form.endDate) {
      setError('Choose both a first and a last day.')
      return
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setError('The last day has to be on or after the first day.')
      return
    }
    setStep('review')
  }

  async function submitRequest() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/holiday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Couldn't send your request. Try again.")
        return
      }
      setStep('sent')
      void load()
    } finally {
      setSubmitting(false)
    }
  }

  function closeFlow() {
    setStep('closed')
    setError(null)
    setForm({ startDate: todayISO(7), endDate: todayISO(7), type: 'ANNUAL', notes: '' })
  }

  async function updateStatus(id: string, status: HolidayStatus) {
    const res = await fetch(`/api/holiday/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) await load()
  }

  const dateMap = useMemo(() => bookedDatesMap(requests), [requests])

  // Who else is off in the chosen range — shown before you send, not after.
  const overlaps = useMemo(() => {
    if (!form.startDate || !form.endDate) return [] as string[]
    const s0 = new Date(form.startDate).getTime()
    const e0 = new Date(form.endDate).getTime()
    const names = new Set<string>()
    for (const r of teamApproved) {
      if (r.userId === me?.id) continue
      if (new Date(r.startDate).getTime() <= e0 && new Date(r.endDate).getTime() >= s0 && r.user?.name) names.add(r.user.name.split(' ')[0])
    }
    return [...names]
  }, [form.startDate, form.endDate, teamApproved, me?.id])

  if (loading) {
    return (
      <Page>
        <div className="space-y-3">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-10 w-40" />
        </div>
        <StatGrid>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-2xl" />
          ))}
        </StatGrid>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </Page>
    )
  }

  const isAdmin = me?.role === 'ADMIN'
  const allowance = balance?.allowance ?? 25
  const used = balance?.used ?? 0
  const pending = balance?.pending ?? 0
  const remaining = balance?.remaining ?? allowance
  const usedPct = Math.min(100, Math.round((used / Math.max(allowance, 1)) * 100))
  const pendingPct = Math.min(100 - usedPct, Math.round((pending / Math.max(allowance, 1)) * 100))
  const days = workingDays(form.startDate, form.endDate)
  const charged = form.type === 'ANNUAL' ? days : 0
  const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <>
      {(step === 'dates' || step === 'review') && (
        <Overlay label="Book time off" onClose={closeFlow}>
          <FlowFrame steps={['Dates', 'Review']} current={step === 'dates' ? 0 : 1} onClose={closeFlow}>
            {step === 'dates' ? (
              <>
                <FlowTitle sub={`An admin approves requests. You have ${remaining} days left this year.`}>When are you off?</FlowTitle>
                <fieldset className="mb-6">
                  <legend className="mb-2 text-[15px] text-ink-2">Type</legend>
                  <div className="grid gap-2">
                    {TYPES.map((t) => {
                      const on = form.type === t.value
                      return (
                        <label
                          key={t.value}
                          className={`flex cursor-pointer items-center gap-3.5 rounded-xl px-4 py-3.5 ${on ? 'shadow-[inset_0_0_0_2px_var(--foreground)]' : 'shadow-[inset_0_0_0_1px_var(--field)] hover:bg-surface'}`}
                        >
                          <input
                            type="radio"
                            name="type"
                            value={t.value}
                            checked={on}
                            onChange={() => setForm({ ...form, type: t.value })}
                            className="size-5 accent-foreground"
                          />
                          <span>
                            <span className="block font-semibold">{t.title}</span>
                            <span className="block text-sm text-muted-foreground">{t.text}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
                <div className="mb-6 grid grid-cols-2 gap-3">
                  <Field label="First day">
                    <input type="date" className={INPUT_CLS} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                  </Field>
                  <Field label="Last day">
                    <input type="date" className={INPUT_CLS} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                  </Field>
                </div>
                <div className="mb-6 rounded-xl bg-surface px-5 py-2">
                  <KV k="Working days" v={days} />
                  <div className="border-t border-line">
                    <KV k="Left after this" v={`${Math.max(0, remaining - charged)} days`} />
                  </div>
                  {overlaps.length > 0 && (
                    <p className="flex items-center gap-2 border-t border-line py-3 text-sm text-ink-2">
                      <Users className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                      {overlaps.join(', ')} {overlaps.length === 1 ? 'is' : 'are'} also off then.
                    </p>
                  )}
                </div>
                {error && <p role="alert" className="mb-4 rounded-xl bg-bad-bg px-4 py-3 text-[15px] font-medium text-bad">{error}</p>}
                <button type="button" onClick={toReview} className={`${pill('primary')} w-full`}>
                  Continue
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep('dates')} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold hover:text-brand">
                  <ChevronLeft className="size-[18px]" strokeWidth={1.75} /> Back
                </button>
                <FlowTitle sub="Check it, then send it for approval.">Review your request</FlowTitle>
                <div className="mb-6 rounded-xl bg-surface px-5 py-2 [&>*+*]:border-t [&>*+*]:border-line">
                  <KV k="Type" v={prettyType(form.type)} />
                  <KV k="From" v={longDate(form.startDate)} />
                  <KV k="To" v={longDate(form.endDate)} />
                  <KV k="Working days" v={days} />
                  <KV k="Left after this" v={`${Math.max(0, remaining - charged)} days`} />
                </div>
                <Field label="Note for the approver (optional)">
                  <textarea className={INPUT_CLS} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
                {error && <p role="alert" className="mt-4 rounded-xl bg-bad-bg px-4 py-3 text-[15px] font-medium text-bad">{error}</p>}
                <button type="button" onClick={submitRequest} disabled={submitting} className={`${pill('primary')} mt-6 w-full`}>
                  {submitting ? 'Sending…' : 'Send request'}
                </button>
              </>
            )}
          </FlowFrame>
        </Overlay>
      )}

      {step === 'sent' && (
        <Overlay label="Request sent" onClose={closeFlow}>
          <SuccessScreen
            title="Request sent"
            actions={
              <>
                <Link href="/me" className={pill('primary')} onClick={closeFlow}>
                  Back to my dashboard
                </Link>
                <button type="button" className={pill('onNavy')} onClick={() => setStep('dates')}>
                  Book more time
                </button>
              </>
            }
          >
            {formatRange(form.startDate, form.endDate)} is with an admin for approval. It shows as pending on the team calendar until then.
          </SuccessScreen>
        </Overlay>
      )}

      <Page>
        <PageHead
          eyebrow={`${balance?.year ?? new Date().getFullYear()} · ${pending ? `${pending} days pending` : 'nothing pending'}`}
          figure={remaining}
          figureNote={`of ${allowance} days left`}
          actions={
            <button type="button" onClick={() => setStep('dates')} className={pill('primary')}>
              <Plus strokeWidth={1.75} /> Book time off
            </button>
          }
        />

        <Split
          main={
            <Panel title="This year">
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
                <div className="flex h-full">
                  <div className="h-full bg-foreground" style={{ width: `${usedPct}%` }} />
                  <div className="h-full bg-primary" style={{ width: `${pendingPct}%` }} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                <Legend color="bg-foreground" label={`${used} used`} />
                <Legend color="bg-primary" label={`${pending} pending`} />
                <Legend color="bg-line" label={`${remaining} left`} />
              </div>
            </Panel>
          }
          side={
            <Panel title="This month">
              <MiniCalendar dateMap={dateMap} />
            </Panel>
          }
        />

        {isAdmin && (
          <Panel title="Waiting for you" action={<span className="text-sm text-muted-foreground">{pendingTeam.length} {pendingTeam.length === 1 ? 'request' : 'requests'}</span>}>
            {pendingTeam.length === 0 ? (
              <p className="py-2 text-[15px] text-muted-foreground">All clear. No requests waiting.</p>
            ) : (
              <Rows>
                {pendingTeam.map((r) => (
                  <Row
                    key={r.id}
                    lead={<Avatar name={r.user?.name} tone="card" />}
                    title={r.user?.name ?? 'Unknown'}
                    meta={`${formatRange(r.startDate, r.endDate)} · ${r.days} ${r.days === 1 ? 'day' : 'days'} · ${prettyType(r.type)}${r.notes ? ` · ${r.notes}` : ''}`}
                    trail={
                      <span className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => setPendingAction({ id: r.id, status: 'REJECTED', who: r.user?.name })} className={pill('danger', 'sm')}>
                          Reject
                        </button>
                        <button type="button" onClick={() => setPendingAction({ id: r.id, status: 'APPROVED', who: r.user?.name })} className={pill('primary', 'sm')}>
                          Approve
                        </button>
                      </span>
                    }
                  />
                ))}
              </Rows>
            )}
          </Panel>
        )}

        <section className="flex flex-col gap-3">
          <SectionHead title="Team calendar" action={<span className="text-sm text-muted-foreground">Approved time off</span>} />
          <TeamCalendar requests={teamApproved} />
        </section>

        <section className="flex flex-col gap-3">
          <SectionHead title="My requests" />
          {requests.length === 0 ? (
            <div className="rounded-2xl bg-surface px-6 py-10 text-center text-[15px] text-muted-foreground">No requests yet.</div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{formatRange(r.startDate, r.endDate)}</td>
                    <td className="tabular-nums">{r.days}</td>
                    <td className="text-ink-2">{prettyType(r.type)}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="max-w-xs truncate text-muted-foreground">{r.notes || '—'}</td>
                    <td className="text-right">
                      {r.status === 'PENDING' && (
                        <button type="button" onClick={() => setPendingAction({ id: r.id, status: 'CANCELLED' })} className="text-sm font-semibold text-muted-foreground hover:text-bad">
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>

        <ConfirmDialog
          open={!!pendingAction}
          title={
            pendingAction?.status === 'APPROVED'
              ? 'Approve request?'
              : pendingAction?.status === 'REJECTED'
                ? 'Reject request?'
                : 'Cancel request?'
          }
          message={
            pendingAction?.status === 'APPROVED'
              ? `Approve ${pendingAction?.who ?? 'this'} time-off request? The days come off their balance.`
              : pendingAction?.status === 'REJECTED'
                ? `Reject ${pendingAction?.who ?? 'this'} time-off request?`
                : 'Cancel this time-off request? This cannot be undone.'
          }
          confirmLabel={
            pendingAction?.status === 'APPROVED' ? 'Approve' : pendingAction?.status === 'REJECTED' ? 'Reject' : 'Cancel request'
          }
          confirmVariant={pendingAction?.status === 'APPROVED' ? 'primary' : 'danger'}
          busy={actionBusy}
          onConfirm={async () => {
            if (!pendingAction) return
            setActionBusy(true)
            try {
              await updateStatus(pendingAction.id, pendingAction.status)
            } finally {
              setActionBusy(false)
              setPendingAction(null)
            }
          }}
          onCancel={() => setPendingAction(null)}
        />
      </Page>
    </>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
    </span>
  )
}

function StatusBadge({ status }: { status: HolidayStatus }) {
  const map: Record<HolidayStatus, { tone: 'warn' | 'ok' | 'bad' | 'neutral'; label: string }> = {
    PENDING: { tone: 'warn', label: 'Pending' },
    APPROVED: { tone: 'ok', label: 'Approved' },
    REJECTED: { tone: 'bad', label: 'Rejected' },
    CANCELLED: { tone: 'neutral', label: 'Cancelled' },
  }
  const cfg = map[status]
  return <Tag tone={cfg.tone}>{cfg.label}</Tag>
}

function prettyType(t: HolidayType): string {
  return t === 'ANNUAL' ? 'Annual leave' : t === 'SICK' ? 'Sick' : t === 'PERSONAL' ? 'Personal' : 'Other'
}

// Per-person colour palette for the team calendar rows.
const TEAM_COLORS = [
  { bar: 'bg-foreground dark:bg-foreground', text: 'text-brand dark:text-brand', dot: 'bg-foreground dark:bg-foreground' },
  { bar: 'bg-[#2F4B8F] dark:bg-[#5B7BC4]', text: 'text-[#2F4B8F] dark:text-[#5B7BC4]', dot: 'bg-[#2F4B8F] dark:bg-[#5B7BC4]' },
  { bar: 'bg-[#2E5E44] dark:bg-[#4E8F6C]', text: 'text-[#2E5E44] dark:text-[#4E8F6C]', dot: 'bg-[#2E5E44] dark:bg-[#4E8F6C]' },
  { bar: 'bg-[#A93B2E] dark:bg-[#D0584A]', text: 'text-[#A93B2E] dark:text-[#D0584A]', dot: 'bg-[#A93B2E] dark:bg-[#D0584A]' },
  { bar: 'bg-[#6B4E8E] dark:bg-[#9678BC]', text: 'text-[#6B4E8E] dark:text-[#9678BC]', dot: 'bg-[#6B4E8E] dark:bg-[#9678BC]' },
  { bar: 'bg-pink-400', text: 'text-pink-700 dark:text-pink-300', dot: 'bg-pink-400' },
]

function localISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Month view of the whole team's approved leave — one colour-coded row per
// person, bars across the days they're off.
function TeamCalendar({ requests }: { requests: HolidayRequest[] }) {
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = localISO(new Date())

  // Group approved requests by person, then expand to a set of off-days.
  const people = useMemo(() => {
    const byUser = new Map<string, { name: string; days: Set<string> }>()
    for (const r of requests) {
      if (r.status !== 'APPROVED') continue
      const id = r.user?.id ?? r.userId
      const name = r.user?.name ?? 'Unknown'
      let entry = byUser.get(id)
      if (!entry) {
        entry = { name, days: new Set() }
        byUser.set(id, entry)
      }
      const cur = new Date(r.startDate)
      const end = new Date(r.endDate)
      cur.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)
      while (cur <= end) {
        entry.days.add(localISO(cur))
        cur.setDate(cur.getDate() + 1)
      }
    }
    return Array.from(byUser.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [requests])

  const monthLabel = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-3">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{monthLabel}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonthDate(new Date(year, month - 1, 1))}
            aria-label="Previous month"
            className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const d = new Date()
              setMonthDate(new Date(d.getFullYear(), d.getMonth(), 1))
            }}
            className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Today
          </button>
          <button
            onClick={() => setMonthDate(new Date(year, month + 1, 1))}
            aria-label="Next month"
            className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
          No approved time off yet — approved holidays will show up here.
        </div>
      ) : (
        <div className="overflow-x-auto px-5 py-4">
          <table className="w-full border-separate" style={{ borderSpacing: '1px 4px' }}>
            <thead>
              <tr>
                <th className="w-32 min-w-32 text-left text-[13px] text-muted-foreground">
                  Person
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = new Date(year, month, i + 1)
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  const isToday = localISO(d) === todayKey
                  return (
                    <th
                      key={i}
                      className={`min-w-5 pb-1 text-center text-[9px] font-medium ${
 isToday ? 'text-brand dark:text-brand font-bold' : isWeekend ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 dark:text-gray-500'
 }`}
                    >
                      {i + 1}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {people.map((p, idx) => {
                const color = TEAM_COLORS[idx % TEAM_COLORS.length]
                return (
                  <tr key={p.id}>
                    <td className="w-32 min-w-32 pr-2">
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${color.text}`}>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${color.dot}`} />
                        <span className="truncate">{p.name}</span>
                      </span>
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const d = new Date(year, month, i + 1)
                      const iso = localISO(d)
                      const off = p.days.has(iso)
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6
                      return (
                        <td key={i} className="min-w-5 p-0">
                          <div
                            title={off ? `${p.name} — off ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : undefined}
                            className={`h-5 rounded-sm ${
                              off ? color.bar : isWeekend ? 'bg-gray-50 dark:bg-gray-800' : 'bg-gray-100/60 dark:bg-gray-800/60'
                            }`}
                          />
                        </td>
                      )
                    })}
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

function MiniCalendar({ dateMap }: { dateMap: Map<string, HolidayStatus> }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = (firstOfMonth.getDay() + 6) % 7 // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: { day: number | null; iso?: string }[] = []
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null })
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = new Date(year, month, d).toISOString().slice(0, 10)
    cells.push({ day: d, iso })
  }

  const monthName = today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const todayKey = today.toISOString().slice(0, 10)

  return (
    <div className="mt-4">
      <div className="mb-3 text-sm font-semibold text-ink-2">{monthName}</div>
      <div className="grid grid-cols-7 gap-1 text-center text-[13px] text-muted-foreground">
        {['M','T','W','T','F','S','S'].map((d, i) => <div key={i} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 mt-1">
        {cells.map((c, i) => {
          if (!c.day) return <div key={i} className="aspect-square" />
          const status = c.iso ? dateMap.get(c.iso) : undefined
          const isToday = c.iso === todayKey
          let cls = 'aspect-square flex items-center justify-center rounded-md text-[11px] font-medium '
          if (status === 'APPROVED') cls += 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
          else if (status === 'PENDING') cls += 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
          else cls += 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          if (isToday) cls += ' ring-2 ring-foreground dark:ring-foreground'
          return <div key={i} className={cls}>{c.day}</div>
        })}
      </div>
    </div>
  )
}
