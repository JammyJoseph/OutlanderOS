'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Clock,
  Edit2,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'

interface Deadline {
  id: string
  title: string
  description?: string | null
  dueDate: string
  source: string
  sourceRef?: string | null
  sourceUrl?: string | null
  type: string
  status: string
  priority: string
  emailFrom?: string | null
  emailSnippet?: string | null
  completedAt?: string | null
  snoozedUntil?: string | null
  createdAt: string
}

const SOURCE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  email: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Email' },
  manual: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Manual' },
  trello: { bg: 'bg-green-50', text: 'text-green-700', label: 'Trello' },
  production: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Production' },
  print: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Print' },
  task: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Task' },
}

const TYPE_LABEL: Record<string, string> = {
  follow_up: 'Follow-up',
  deliverable: 'Deliverable',
  meeting: 'Meeting',
  review: 'Review',
  payment: 'Payment',
  other: 'Other',
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-amber-500',
  MEDIUM: 'bg-gray-400',
  LOW: 'bg-gray-300',
}

const DAY_MS = 86_400_000

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatCountdown(due: string): { label: string; tone: 'overdue' | 'today' | 'soon' | 'later' } {
  const dueDate = new Date(due)
  const now = new Date()
  const diffMs = dueDate.getTime() - now.getTime()
  const dueDay = startOfDay(dueDate).getTime()
  const today = startOfDay(now).getTime()
  const dayDiff = Math.round((dueDay - today) / DAY_MS)

  if (dayDiff < 0) {
    const abs = Math.abs(dayDiff)
    return {
      label: `${abs} day${abs === 1 ? '' : 's'} overdue`,
      tone: 'overdue',
    }
  }
  if (dayDiff === 0) {
    if (diffMs < 0) {
      return { label: 'Overdue today', tone: 'overdue' }
    }
    return { label: 'Due today', tone: 'today' }
  }
  if (dayDiff <= 7) {
    return { label: `Due in ${dayDiff} day${dayDiff === 1 ? '' : 's'}`, tone: 'soon' }
  }
  return {
    label: `Due ${dueDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    })}`,
    tone: 'later',
  }
}

function bucketFor(deadline: Deadline): 'overdue' | 'today' | 'week' | 'upcoming' | 'done' {
  if (deadline.status === 'COMPLETED') return 'done'
  const dueDate = new Date(deadline.dueDate)
  const now = new Date()
  const dayDiff = Math.round(
    (startOfDay(dueDate).getTime() - startOfDay(now).getTime()) / DAY_MS
  )
  if (dayDiff < 0) return 'overdue'
  if (dayDiff === 0) return 'today'
  if (dayDiff <= 7) return 'week'
  return 'upcoming'
}

interface NewDeadlineForm {
  title: string
  dueDate: string
  type: string
  priority: string
  description: string
}

const EMPTY_FORM: NewDeadlineForm = {
  title: '',
  dueDate: '',
  type: 'follow_up',
  priority: 'MEDIUM',
  description: '',
}

export default function MePage() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<NewDeadlineForm>(EMPTY_FORM)
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/deadlines')
      const data = await res.json()
      if (Array.isArray(data)) {
        setDeadlines(data)
      } else {
        setDeadlines([])
      }
    } catch {
      setDeadlines([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const buckets = useMemo(() => {
    const overdue: Deadline[] = []
    const today: Deadline[] = []
    const week: Deadline[] = []
    const upcoming: Deadline[] = []
    const done: Deadline[] = []
    for (const d of deadlines) {
      const b = bucketFor(d)
      if (b === 'overdue') overdue.push(d)
      else if (b === 'today') today.push(d)
      else if (b === 'week') week.push(d)
      else if (b === 'upcoming') upcoming.push(d)
      else done.push(d)
    }
    const sortByDue = (a: Deadline, b: Deadline) =>
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    overdue.sort(sortByDue)
    today.sort(sortByDue)
    week.sort(sortByDue)
    upcoming.sort(sortByDue)
    return { overdue, today, week, upcoming, done }
  }, [deadlines])

  const completedThisWeek = useMemo(() => {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    return deadlines.filter(
      (d) =>
        d.status === 'COMPLETED' &&
        d.completedAt &&
        new Date(d.completedAt) >= oneWeekAgo
    ).length
  }, [deadlines])

  async function createDeadline() {
    if (!form.title.trim() || !form.dueDate) {
      showToast('Title and due date are required')
      return
    }
    try {
      const res = await fetch('/api/deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          dueDate: new Date(form.dueDate).toISOString(),
          type: form.type,
          priority: form.priority,
          description: form.description || undefined,
        }),
      })
      if (!res.ok) {
        showToast('Failed to create deadline')
        return
      }
      setForm(EMPTY_FORM)
      setShowAddForm(false)
      load()
    } catch {
      showToast('Network error')
    }
  }

  async function updateDeadline(id: string, patch: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/deadlines/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        showToast('Failed to update')
        return
      }
      load()
    } catch {
      showToast('Network error')
    }
  }

  async function saveEdit(id: string) {
    if (!form.title.trim() || !form.dueDate) return
    await updateDeadline(id, {
      title: form.title,
      dueDate: new Date(form.dueDate).toISOString(),
      type: form.type,
      priority: form.priority,
      description: form.description || null,
    })
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function deleteDeadline(id: string) {
    if (!confirm('Delete this deadline?')) return
    try {
      await fetch(`/api/deadlines/${id}`, { method: 'DELETE' })
      load()
    } catch {
      showToast('Network error')
    }
  }

  function snooze(id: string, days: number) {
    const until = new Date()
    until.setDate(until.getDate() + days)
    updateDeadline(id, { status: 'SNOOZED', snoozedUntil: until.toISOString() })
    setSnoozeOpenId(null)
  }

  async function scanEmail() {
    setScanning(true)
    showToast('Scanning email…')
    try {
      const res = await fetch('/api/deadlines/scan-email', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        showToast(
          `Scanned ${data.scanned} emails — ${data.created} new deadline${data.created === 1 ? '' : 's'} found`
        )
        load()
      } else {
        showToast(data.error || 'Email scan failed')
      }
    } catch {
      showToast('Email scan failed')
    } finally {
      setScanning(false)
    }
  }

  async function syncPortals() {
    setSyncing(true)
    showToast('Syncing portals…')
    try {
      const res = await fetch('/api/deadlines/sync-portals', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        showToast(
          `Synced — ${data.created} new, ${data.updated} updated`
        )
        load()
      } else {
        showToast(data.error || 'Portal sync failed')
      }
    } catch {
      showToast('Portal sync failed')
    } finally {
      setSyncing(false)
    }
  }

  function startEdit(d: Deadline) {
    setEditingId(d.id)
    const localDate = new Date(d.dueDate)
    const yyyy = localDate.getFullYear()
    const mm = String(localDate.getMonth() + 1).padStart(2, '0')
    const dd = String(localDate.getDate()).padStart(2, '0')
    setForm({
      title: d.title,
      dueDate: `${yyyy}-${mm}-${dd}`,
      type: d.type,
      priority: d.priority,
      description: d.description ?? '',
    })
    setShowAddForm(false)
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-xl font-sans">
          {toast}
        </div>
      )}

      <div className="mx-auto max-w-5xl px-6 py-8 font-sans">
        {/* Briefing header */}
        <header className="mb-8">
          <p className="text-[11px] font-semibold tracking-[0.25em] text-gray-400 uppercase">
            Personal Dashboard
          </p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Your active commitments, follow-ups, and deadlines.
          </p>
        </header>

        {/* Deadline Tracker */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Deadline Tracker</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Auto-scans email, syncs portals, and tracks your time-based commitments.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={scanEmail}
                disabled={scanning}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {scanning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="h-3.5 w-3.5" />
                )}
                Scan Email
              </button>
              <button
                onClick={syncPortals}
                disabled={syncing}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Sync Portals
              </button>
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm)
                  setEditingId(null)
                  setForm(EMPTY_FORM)
                }}
                className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Deadline
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              count={buckets.overdue.length}
              label="Overdue"
              tone="red"
            />
            <StatCard
              count={buckets.today.length}
              label="Due today"
              tone="amber"
            />
            <StatCard
              count={buckets.week.length}
              label="This week"
              tone="gray"
            />
            <StatCard
              count={completedThisWeek}
              label="Completed (7d)"
              tone="green"
            />
          </div>

          {/* Add / edit form */}
          {(showAddForm || editingId) && (
            <DeadlineForm
              form={form}
              setForm={setForm}
              onSave={() => (editingId ? saveEdit(editingId) : createDeadline())}
              onCancel={() => {
                setShowAddForm(false)
                setEditingId(null)
                setForm(EMPTY_FORM)
              }}
              isEditing={!!editingId}
            />
          )}

          {/* Lists */}
          <div className="mt-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : deadlines.length === 0 ? (
              <EmptyState onAdd={() => setShowAddForm(true)} />
            ) : (
              <>
                <DeadlineGroup
                  title="Overdue"
                  tone="red"
                  items={buckets.overdue}
                  onComplete={(id) =>
                    updateDeadline(id, { status: 'COMPLETED' })
                  }
                  onDelete={deleteDeadline}
                  onEdit={startEdit}
                  onSnooze={snooze}
                  snoozeOpenId={snoozeOpenId}
                  setSnoozeOpenId={setSnoozeOpenId}
                />
                <DeadlineGroup
                  title="Today"
                  tone="amber"
                  items={buckets.today}
                  onComplete={(id) =>
                    updateDeadline(id, { status: 'COMPLETED' })
                  }
                  onDelete={deleteDeadline}
                  onEdit={startEdit}
                  onSnooze={snooze}
                  snoozeOpenId={snoozeOpenId}
                  setSnoozeOpenId={setSnoozeOpenId}
                />
                <DeadlineGroup
                  title="This Week"
                  tone="white"
                  items={buckets.week}
                  onComplete={(id) =>
                    updateDeadline(id, { status: 'COMPLETED' })
                  }
                  onDelete={deleteDeadline}
                  onEdit={startEdit}
                  onSnooze={snooze}
                  snoozeOpenId={snoozeOpenId}
                  setSnoozeOpenId={setSnoozeOpenId}
                />
                <DeadlineGroup
                  title="Upcoming"
                  tone="muted"
                  items={buckets.upcoming}
                  onComplete={(id) =>
                    updateDeadline(id, { status: 'COMPLETED' })
                  }
                  onDelete={deleteDeadline}
                  onEdit={startEdit}
                  onSnooze={snooze}
                  snoozeOpenId={snoozeOpenId}
                  setSnoozeOpenId={setSnoozeOpenId}
                />
                {buckets.done.length > 0 && (
                  <DeadlineGroup
                    title={`Recently Completed (${buckets.done.length})`}
                    tone="muted"
                    items={buckets.done.slice(0, 10)}
                    onComplete={(id) =>
                      updateDeadline(id, { status: 'ACTIVE' })
                    }
                    onDelete={deleteDeadline}
                    onEdit={startEdit}
                    onSnooze={snooze}
                    snoozeOpenId={snoozeOpenId}
                    setSnoozeOpenId={setSnoozeOpenId}
                    completedView
                  />
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({
  count,
  label,
  tone,
}: {
  count: number
  label: string
  tone: 'red' | 'amber' | 'gray' | 'green'
}) {
  const styles = {
    red: 'bg-red-50 text-red-700 ring-red-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    gray: 'bg-gray-50 text-gray-700 ring-gray-100',
    green: 'bg-green-50 text-green-700 ring-green-100',
  }[tone]

  return (
    <div className={`rounded-xl px-4 py-3 ring-1 ${styles}`}>
      <p className="text-2xl font-bold leading-tight">{count}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-80 mt-0.5">
        {label}
      </p>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
      <p className="text-sm text-gray-500">
        No deadlines yet. Scan your inbox or add one manually.
      </p>
      <button
        onClick={onAdd}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gray-900 hover:underline"
      >
        <Plus className="h-3 w-3" />
        Add your first deadline
      </button>
    </div>
  )
}

function DeadlineForm({
  form,
  setForm,
  onSave,
  onCancel,
  isEditing,
}: {
  form: NewDeadlineForm
  setForm: (f: NewDeadlineForm) => void
  onSave: () => void
  onCancel: () => void
  isEditing: boolean
}) {
  return (
    <div className="mt-4 rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100">
      <p className="text-xs font-semibold text-gray-700 mb-3">
        {isEditing ? 'Edit deadline' : 'New deadline'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
            Title
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What needs tracking?"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
            Due date
          </label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
            Type
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          >
            <option value="follow_up">Follow-up</option>
            <option value="deliverable">Deliverable</option>
            <option value="meeting">Meeting</option>
            <option value="review">Review</option>
            <option value="payment">Payment</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
            Priority
          </label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">
            Description (optional)
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none resize-none"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
        >
          {isEditing ? 'Save changes' : 'Add deadline'}
        </button>
      </div>
    </div>
  )
}

function DeadlineGroup({
  title,
  tone,
  items,
  onComplete,
  onDelete,
  onEdit,
  onSnooze,
  snoozeOpenId,
  setSnoozeOpenId,
  completedView = false,
}: {
  title: string
  tone: 'red' | 'amber' | 'white' | 'muted'
  items: Deadline[]
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (d: Deadline) => void
  onSnooze: (id: string, days: number) => void
  snoozeOpenId: string | null
  setSnoozeOpenId: (id: string | null) => void
  completedView?: boolean
}) {
  if (items.length === 0) return null

  const headerTone = {
    red: 'text-red-700',
    amber: 'text-amber-700',
    white: 'text-gray-800',
    muted: 'text-gray-500',
  }[tone]

  return (
    <div>
      <h3 className={`text-xs font-semibold uppercase tracking-widest mb-2 ${headerTone}`}>
        {title}
        <span className="ml-2 text-gray-400">{items.length}</span>
      </h3>
      <ul className="space-y-2">
        {items.map((d) => (
          <DeadlineRow
            key={d.id}
            deadline={d}
            tone={tone}
            onComplete={onComplete}
            onDelete={onDelete}
            onEdit={onEdit}
            onSnooze={onSnooze}
            snoozeOpen={snoozeOpenId === d.id}
            setSnoozeOpen={(open) => setSnoozeOpenId(open ? d.id : null)}
            completedView={completedView}
          />
        ))}
      </ul>
    </div>
  )
}

function DeadlineRow({
  deadline,
  tone,
  onComplete,
  onDelete,
  onEdit,
  onSnooze,
  snoozeOpen,
  setSnoozeOpen,
  completedView,
}: {
  deadline: Deadline
  tone: 'red' | 'amber' | 'white' | 'muted'
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (d: Deadline) => void
  onSnooze: (id: string, days: number) => void
  snoozeOpen: boolean
  setSnoozeOpen: (open: boolean) => void
  completedView: boolean
}) {
  const cd = formatCountdown(deadline.dueDate)
  const sourceBadge = SOURCE_BADGE[deadline.source] ?? SOURCE_BADGE.manual
  const typeLabel = TYPE_LABEL[deadline.type] ?? deadline.type
  const priorityDot = PRIORITY_DOT[deadline.priority] ?? PRIORITY_DOT.MEDIUM

  const rowBg = completedView
    ? 'bg-gray-50/50'
    : tone === 'red'
    ? 'bg-red-50/40'
    : tone === 'amber'
    ? 'bg-amber-50/40'
    : tone === 'muted'
    ? 'bg-gray-50/40'
    : 'bg-white'

  const countdownClass =
    cd.tone === 'overdue'
      ? 'text-red-600 font-bold'
      : cd.tone === 'today'
      ? 'text-amber-700 font-semibold'
      : cd.tone === 'soon'
      ? 'text-gray-700 font-medium'
      : 'text-gray-500'

  return (
    <li
      className={`rounded-xl ${rowBg} ring-1 ring-gray-100 px-4 py-3 transition-shadow hover:shadow-sm`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onComplete(deadline.id)}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            completedView
              ? 'border-green-500 bg-green-500 text-white hover:bg-green-600'
              : 'border-gray-300 bg-white hover:border-gray-900 hover:bg-gray-900 hover:text-white text-transparent'
          }`}
          title={completedView ? 'Mark active' : 'Complete'}
        >
          <Check className="h-3 w-3" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityDot}`} />
            <p
              className={`text-sm font-medium leading-snug ${
                completedView ? 'text-gray-500 line-through' : 'text-gray-900'
              }`}
            >
              {deadline.title}
            </p>
          </div>

          {deadline.description && !completedView && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {deadline.description}
            </p>
          )}

          {deadline.emailSnippet && !completedView && (
            <blockquote className="mt-1.5 border-l-2 border-blue-200 pl-2 text-[11px] italic text-gray-500">
              &ldquo;{deadline.emailSnippet}&rdquo;
              {deadline.emailFrom && (
                <span className="ml-1 not-italic text-gray-400">
                  — {deadline.emailFrom.replace(/<[^>]+>/, '').trim()}
                </span>
              )}
            </blockquote>
          )}

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] uppercase tracking-wide ${countdownClass}`}>
              {cd.label}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sourceBadge.bg} ${sourceBadge.text}`}
            >
              {sourceBadge.label}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              {typeLabel}
            </span>
            {deadline.sourceUrl && (
              <a
                href={deadline.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-600 hover:underline"
              >
                Open source
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 relative">
          {!completedView && (
            <>
              <div className="relative">
                <button
                  onClick={() => setSnoozeOpen(!snoozeOpen)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  title="Snooze"
                >
                  <Clock className="h-3.5 w-3.5" />
                </button>
                {snoozeOpen && (
                  <div className="absolute right-0 top-8 z-10 w-32 rounded-lg border border-gray-200 bg-white py-1 shadow-md">
                    <button
                      onClick={() => onSnooze(deadline.id, 1)}
                      className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                    >
                      +1 day
                    </button>
                    <button
                      onClick={() => onSnooze(deadline.id, 3)}
                      className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                    >
                      +3 days
                    </button>
                    <button
                      onClick={() => onSnooze(deadline.id, 7)}
                      className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                    >
                      +1 week
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => onEdit(deadline)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title="Edit"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(deadline.id)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            {completedView ? <X className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </li>
  )
}
