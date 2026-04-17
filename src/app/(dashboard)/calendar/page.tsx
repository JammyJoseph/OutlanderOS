'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Clock, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarEvent {
  id: string | null | undefined
  summary: string
  start: string
  end: string
  location: string
  kind: 'meeting' | 'invoice' | 'payroll' | 'vat'
}

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  calendar?: {
    todayEvents: { id?: string | null; summary: string; start: string; end: string; location: string }[]
    error?: string
  }
  xero?: {
    invoices?: { id: string; contact: string; dueDate: string; amountDue: number; status: string }[]
  }
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Quarter months for VAT: Jan=0, Apr=3, Jul=6, Oct=9
const VAT_MONTHS = new Set([0, 3, 6, 9])

function generateCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const offset = (firstDay.getDay() + 6) % 7
  const days: (number | null)[] = []
  for (let i = 0; i < offset; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function formatTime(iso: string) {
  if (!iso) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'All day'
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatTimeFull(iso: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function getEventDate(iso: string): { year: number; month: number; day: number } | null {
  if (!iso) return null
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T00:00:00') : new Date(iso)
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
  } catch {
    return null
  }
}

const KIND_DOT: Record<CalendarEvent['kind'], string> = {
  meeting: 'bg-blue-400',
  invoice: 'bg-amber-400',
  payroll: 'bg-sky-400',
  vat: 'bg-red-400',
}

const KIND_PILL: Record<CalendarEvent['kind'], string> = {
  meeting: 'bg-blue-100 text-blue-700',
  invoice: 'bg-amber-100 text-amber-700',
  payroll: 'bg-sky-100 text-sky-700',
  vat: 'bg-red-100 text-red-700',
}

function buildSyntheticEvents(data: DashboardData, year: number): CalendarEvent[] {
  const events: CalendarEvent[] = []

  // Invoice due dates from Xero
  const invoices = data.xero?.invoices || []
  for (const inv of invoices) {
    if (!inv.dueDate) continue
    events.push({
      id: `inv-${inv.id}`,
      summary: `Invoice due: ${inv.contact} (£${inv.amountDue?.toLocaleString() || 0})`,
      start: inv.dueDate,
      end: inv.dueDate,
      location: '',
      kind: 'invoice',
    })
  }

  // Payroll: 25th of every month in the viewed year
  for (let m = 0; m < 12; m++) {
    const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-25`
    events.push({
      id: `payroll-${year}-${m}`,
      summary: 'Payroll',
      start: dateStr,
      end: dateStr,
      location: '',
      kind: 'payroll',
    })
  }

  // VAT: 7th of Jan, Apr, Jul, Oct
  for (const m of [0, 3, 6, 9]) {
    const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-07`
    events.push({
      id: `vat-${year}-${m}`,
      summary: 'VAT Return Deadline',
      start: dateStr,
      end: dateStr,
      location: '',
      kind: 'vat',
    })
  }

  return events
}

export default function CalendarPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedDay, setExpandedDay] = useState<number | null>(null)
  const now = new Date()
  const [calMonth, setCalMonth] = useState({ year: now.getFullYear(), month: now.getMonth() })

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-500" />
          <p className="text-sm text-gray-600">{error}</p>
          <button onClick={load} className="mt-3 text-xs text-[#D4A853] hover:underline">Retry</button>
        </div>
      </div>
    )
  }

  if (!data?.connected.primary) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600">Connect operations@ to view calendar</p>
          <a
            href="/api/google/connect?label=primary"
            className="mt-4 inline-block rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-medium text-gray-900 hover:bg-[#C49843] transition-colors"
          >
            Connect Google Calendar
          </a>
        </div>
      </div>
    )
  }

  const googleEvents: CalendarEvent[] = (data?.calendar?.todayEvents || []).map(e => ({
    ...e,
    id: e.id ?? null,
    kind: 'meeting' as const,
  }))

  const syntheticEvents = buildSyntheticEvents(data!, calMonth.year)
  const allEvents = [...googleEvents, ...syntheticEvents]

  const calDays = generateCalendarDays(calMonth.year, calMonth.month)

  const getEventsForDay = (day: number) =>
    allEvents.filter(e => {
      const d = getEventDate(e.start)
      return d && d.year === calMonth.year && d.month === calMonth.month && d.day === day
    })

  const prevMonth = () => {
    setExpandedDay(null)
    setCalMonth(prev => ({
      month: prev.month === 0 ? 11 : prev.month - 1,
      year: prev.month === 0 ? prev.year - 1 : prev.year,
    }))
  }

  const nextMonth = () => {
    setExpandedDay(null)
    setCalMonth(prev => ({
      month: prev.month === 11 ? 0 : prev.month + 1,
      year: prev.month === 11 ? prev.year + 1 : prev.year,
    }))
  }

  const today = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() }
  const isToday = (day: number) =>
    day === today.day && calMonth.month === today.month && calMonth.year === today.year

  const expandedEvents = expandedDay ? getEventsForDay(expandedDay) : []

  // Legend
  const legend = [
    { kind: 'meeting' as const, label: 'Meeting' },
    { kind: 'invoice' as const, label: 'Invoice due' },
    { kind: 'payroll' as const, label: 'Payroll' },
    { kind: 'vat' as const, label: 'VAT deadline' },
  ]

  return (
    <div className="flex flex-col gap-6 py-6 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Calendar</h1>
          <div className="flex items-center gap-3">
            {legend.map(l => (
              <span key={l.kind} className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className={cn('h-2 w-2 rounded-full', KIND_DOT[l.kind])} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {data?.calendar?.error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {data.calendar.error}
          </div>
        )}

        {/* Month navigation + grid */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <button onClick={prevMonth} className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800">
              {MONTH_NAMES[calMonth.month]} {calMonth.year}
            </span>
            <button onClick={nextMonth} className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {DOW_LABELS.map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-medium uppercase tracking-wider text-gray-400">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calDays.map((day, i) => {
              const dayEvents = day ? getEventsForDay(day) : []
              const isExpanded = expandedDay === day
              return (
                <div
                  key={i}
                  onClick={() => day && setExpandedDay(isExpanded ? null : day)}
                  className={cn(
                    'min-h-[72px] border-b border-r border-gray-200 p-1.5 cursor-pointer',
                    !day && 'bg-gray-50 cursor-default',
                    i % 7 === 6 && 'border-r-0',
                    isToday(day!) && day && 'ring-2 ring-inset ring-[#D4A853]',
                    isExpanded && 'bg-amber-50',
                  )}
                >
                  {day && (
                    <>
                      <span
                        className={cn(
                          'mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs',
                          isToday(day) ? 'bg-[#D4A853] font-bold text-gray-900' : 'text-gray-500'
                        )}
                      >
                        {day}
                      </span>
                      <div className="flex flex-wrap gap-0.5">
                        {dayEvents.map(e => (
                          <span
                            key={e.id}
                            className={cn('h-1.5 w-1.5 rounded-full', KIND_DOT[e.kind])}
                            title={e.summary}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Expanded day panel */}
        {expandedDay && expandedEvents.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {MONTH_NAMES[calMonth.month]} {expandedDay} — Events
            </h2>
            <div className="space-y-2">
              {expandedEvents.map(event => (
                <div
                  key={event.id}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-4 py-3',
                    event.kind === 'meeting' && 'border-blue-100 bg-blue-50',
                    event.kind === 'invoice' && 'border-amber-100 bg-amber-50',
                    event.kind === 'payroll' && 'border-sky-100 bg-sky-50',
                    event.kind === 'vat' && 'border-red-100 bg-red-50',
                  )}
                >
                  <span className={cn('mt-1 h-2 w-2 rounded-full shrink-0', KIND_DOT[event.kind])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{event.summary}</p>
                    {event.kind === 'meeting' && (
                      <p className="text-xs text-gray-500 mt-0.5">{formatTimeFull(event.start)}</p>
                    )}
                    {event.location && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </div>
                    )}
                  </div>
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', KIND_PILL[event.kind])}>
                    {event.kind === 'meeting' ? formatTime(event.start) : event.kind}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Today's meetings */}
        {googleEvents.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Today&apos;s Meetings
            </h2>
            <div className="space-y-2">
              {googleEvents.map(event => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
                >
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{event.summary}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatTimeFull(event.start)}</p>
                    {event.location && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {googleEvents.length === 0 && !data?.calendar?.error && (
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center">
            <p className="text-sm text-gray-500">No meetings today.</p>
            <p className="mt-1 text-xs text-gray-400">Click a day to see its events.</p>
          </div>
        )}

      </div>
    </div>
  )
}
