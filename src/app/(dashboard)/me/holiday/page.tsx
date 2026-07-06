'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, Plus, X, Check, AlertTriangle, Clock, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field } from '@/components/ui/Field'
import { INPUT_CLS } from '@/lib/styles'

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

export default function HolidayPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [balance, setBalance] = useState<Balance | null>(null)
  const [requests, setRequests] = useState<HolidayRequest[]>([])
  const [teamApproved, setTeamApproved] = useState<HolidayRequest[]>([])
  const [pendingTeam, setPendingTeam] = useState<HolidayRequest[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
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

  async function submitRequest() {
    setError(null)
    if (!form.startDate || !form.endDate) {
      setError('Please choose both a start and end date.')
      return
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setError('End date must be on or after the start date.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/holiday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to submit request')
        return
      }
      setShowForm(false)
      setForm({ startDate: todayISO(7), endDate: todayISO(7), type: 'ANNUAL', notes: '' })
      await load()
    } finally {
      setSubmitting(false)
    }
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

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
            <Skeleton className="h-6 w-40" />
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="mt-5 h-2.5 w-full rounded-full" />
          </div>
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-4 h-48 w-full rounded-xl" />
          </div>
        </div>
        <Skeleton className="mt-10 h-40 w-full rounded-2xl" />
      </div>
    )
  }

  const isAdmin = me?.role === 'ADMIN'
  const allowance = balance?.allowance ?? 25
  const used = balance?.used ?? 0
  const pending = balance?.pending ?? 0
  const remaining = balance?.remaining ?? allowance
  const usedPct = Math.min(100, Math.round((used / Math.max(allowance, 1)) * 100))
  const pendingPct = Math.min(100 - usedPct, Math.round((pending / Math.max(allowance, 1)) * 100))

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Holiday</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Request time off and view your balance</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Holiday balance</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Annual leave for {balance?.year ?? new Date().getFullYear()}</p>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#9C7C2E] px-3.5 py-2 text-sm font-semibold text-black hover:brightness-95"
            >
              <Plus className="h-4 w-4" /> Request time off
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <BalanceTile label="Allowance" value={`${allowance}`} suffix="days" />
            <BalanceTile label="Used" value={`${used}`} suffix="days" tone="green" />
            <BalanceTile label="Pending" value={`${pending}`} suffix="days" tone="amber" />
            <BalanceTile label="Remaining" value={`${remaining}`} suffix="days" tone="primary" />
          </div>

          <div className="mt-5">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="flex h-full">
                <div className="h-full bg-emerald-400" style={{ width: `${usedPct}%` }} />
                <div className="h-full bg-amber-300" style={{ width: `${pendingPct}%` }} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
              <Legend color="bg-emerald-400" label="Used" />
              <Legend color="bg-amber-300" label="Pending" />
              <Legend color="bg-gray-100 dark:bg-gray-800" label="Remaining" />
            </div>
          </div>

          {showForm && (
            <div className="mt-6 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/60 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New request</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Start date">
                  <input type="date" className={INPUT_CLS} value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </Field>
                <Field label="End date">
                  <input type="date" className={INPUT_CLS} value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </Field>
                <Field label="Type">
                  <select className={INPUT_CLS} value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as HolidayType })}>
                    <option value="ANNUAL">Annual leave</option>
                    <option value="SICK">Sick</option>
                    <option value="PERSONAL">Personal</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Notes (optional)" wide>
                  <textarea className={INPUT_CLS} rows={2} value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
              </div>
              {error && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> {error}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                <button onClick={submitRequest} disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#9C7C2E] px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-50">
                  <Check className="h-4 w-4" /> {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">This month</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Booked days at a glance</p>
          <MiniCalendar dateMap={dateMap} />
        </div>
      </div>

      <section className="mt-10">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Team calendar</h2>
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Approved time off across the team</p>
        <TeamCalendar requests={teamApproved} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">My requests</h2>
        <div className="mt-4 overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
          {requests.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No requests yet. Click <span className="font-medium text-gray-600 dark:text-gray-400">Request time off</span> to book some leave.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  <th className="px-5 py-3">Dates</th>
                  <th className="px-5 py-3">Days</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Notes</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/60 dark:hover:bg-gray-800/60">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{formatRange(r.startDate, r.endDate)}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{r.days}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{prettyType(r.type)}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-xs truncate">{r.notes || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      {r.status === 'PENDING' && (
                        <button onClick={() => setPendingAction({ id: r.id, status: 'CANCELLED' })}
                          className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-700 dark:hover:text-red-300">Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {isAdmin && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pending approvals</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">{pendingTeam.length} {pendingTeam.length === 1 ? 'request' : 'requests'}</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
            {pendingTeam.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">All clear — no pending requests.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    <th className="px-5 py-3">Requester</th>
                    <th className="px-5 py-3">Dates</th>
                    <th className="px-5 py-3">Days</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Notes</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTeam.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/60 dark:hover:bg-gray-800/60">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{r.user?.name ?? 'Unknown'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{r.user?.department || r.user?.email}</div>
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{formatRange(r.startDate, r.endDate)}</td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{r.days}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{prettyType(r.type)}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-xs truncate">{r.notes || '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <button onClick={() => setPendingAction({ id: r.id, status: 'APPROVED', who: r.user?.name })}
                            className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30">Approve</button>
                          <button onClick={() => setPendingAction({ id: r.id, status: 'REJECTED', who: r.user?.name })}
                            className="rounded-lg bg-red-50 dark:bg-red-900/30 px-2.5 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30">Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

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
            ? `Approve ${pendingAction?.who ?? 'this'} time-off request? The days will be deducted from their balance.`
            : pendingAction?.status === 'REJECTED'
              ? `Reject ${pendingAction?.who ?? 'this'} time-off request?`
              : 'Cancel this time-off request? This cannot be undone.'
        }
        confirmLabel={
          pendingAction?.status === 'APPROVED'
            ? 'Approve'
            : pendingAction?.status === 'REJECTED'
              ? 'Reject'
              : 'Cancel request'
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
    </div>
  )
}

function BalanceTile({ label, value, suffix, tone }: { label: string; value: string; suffix: string; tone?: 'green' | 'amber' | 'primary' }) {
  const toneClass =
    tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
    tone === 'amber' ? 'text-amber-600 dark:text-amber-400' :
    tone === 'primary' ? 'text-[#9C7C2E]' :
    'text-gray-900 dark:text-gray-100'
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/40 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-2xl font-semibold ${toneClass}`}>{value}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{suffix}</span>
      </div>
    </div>
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
  const map: Record<HolidayStatus, { bg: string; text: string; label: string; icon?: React.ReactNode }> = {
    PENDING: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300', label: 'Pending', icon: <Clock className="h-3 w-3" /> },
    APPROVED: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-300', label: 'Approved', icon: <Check className="h-3 w-3" /> },
    REJECTED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', label: 'Rejected', icon: <X className="h-3 w-3" /> },
    CANCELLED: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: 'Cancelled' },
  }
  const cfg = map[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function prettyType(t: HolidayType): string {
  return t === 'ANNUAL' ? 'Annual leave' : t === 'SICK' ? 'Sick' : t === 'PERSONAL' ? 'Personal' : 'Other'
}

// Per-person colour palette for the team calendar rows.
const TEAM_COLORS = [
  { bar: 'bg-[#9C7C2E]', text: 'text-[#9C7C2E]', dot: 'bg-[#9C7C2E]' },
  { bar: 'bg-[#2F4B8F]', text: 'text-[#2F4B8F]', dot: 'bg-[#2F4B8F]' },
  { bar: 'bg-[#2E5E44]', text: 'text-[#2E5E44]', dot: 'bg-[#2E5E44]' },
  { bar: 'bg-[#A93B2E]', text: 'text-[#A93B2E]', dot: 'bg-[#A93B2E]' },
  { bar: 'bg-[#6B4E8E]', text: 'text-[#6B4E8E]', dot: 'bg-[#6B4E8E]' },
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
                <th className="w-32 min-w-32 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
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
                        isToday ? 'text-[#9C7C2E] font-bold' : isWeekend ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 dark:text-gray-500'
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
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
        <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" /> {monthName}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
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
          if (isToday) cls += ' ring-2 ring-[#9C7C2E]'
          return <div key={i} className={cls}>{c.day}</div>
        })}
      </div>
    </div>
  )
}
