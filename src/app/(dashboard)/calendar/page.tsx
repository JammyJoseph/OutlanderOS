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
}

interface DashboardData {
  connected: { billing: boolean; primary: boolean }
  calendar?: {
    todayEvents: CalendarEvent[]
    error?: string
  }
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function generateCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay()
  const offset = (startDow + 6) % 7 // Mon=0
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
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function getEventDate(iso: string): { year: number; month: number; day: number } | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
  } catch {
    return null
  }
}

export default function CalendarPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const now = new Date()
  const [calMonth, setCalMonth] = useState({ year: now.getFullYear(), month: now.getMonth() })

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
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
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-400" />
          <p className="text-sm text-zinc-400">{error}</p>
          <button onClick={load} className="mt-3 text-xs text-[#D4A853] hover:underline">Retry</button>
        </div>
      </div>
    )
  }

  if (!data?.connected.primary) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-400">Connect operations@ to view calendar</p>
          <a
            href="/api/google/connect?label=primary"
            className="mt-4 inline-block rounded-lg bg-[#D4A853] px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-[#C49843] transition-colors"
          >
            Connect Google Calendar
          </a>
        </div>
      </div>
    )
  }

  const events = data?.calendar?.todayEvents || []
  const calDays = generateCalendarDays(calMonth.year, calMonth.month)

  const getEventsForDay = (day: number) =>
    events.filter(e => {
      const d = getEventDate(e.start)
      return d && d.year === calMonth.year && d.month === calMonth.month && d.day === day
    })

  const prevMonth = () =>
    setCalMonth(prev => ({
      month: prev.month === 0 ? 11 : prev.month - 1,
      year: prev.month === 0 ? prev.year - 1 : prev.year,
    }))

  const nextMonth = () =>
    setCalMonth(prev => ({
      month: prev.month === 11 ? 0 : prev.month + 1,
      year: prev.month === 11 ? prev.year + 1 : prev.year,
    }))

  const today = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() }
  const isToday = (day: number) =>
    day === today.day && calMonth.month === today.month && calMonth.year === today.year

  return (
    <div className="flex flex-col gap-6 py-6 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Calendar</h1>
          <p className="text-xs text-zinc-500">operations@outlandermag.com</p>
        </div>

        {data?.calendar?.error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/10 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {data.calendar.error}
          </div>
        )}

        {/* Month navigation */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <button
              onClick={prevMonth}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-zinc-200">
              {MONTH_NAMES[calMonth.month]} {calMonth.year}
            </span>
            <button
              onClick={nextMonth}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-zinc-800">
            {DOW_LABELS.map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calDays.map((day, i) => {
              const dayEvents = day ? getEventsForDay(day) : []
              return (
                <div
                  key={i}
                  className={cn(
                    'min-h-[72px] border-b border-r border-zinc-800 p-1.5',
                    !day && 'bg-zinc-950/50',
                    i % 7 === 6 && 'border-r-0'
                  )}
                >
                  {day && (
                    <>
                      <span
                        className={cn(
                          'mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs',
                          isToday(day)
                            ? 'bg-[#D4A853] font-bold text-zinc-900'
                            : 'text-zinc-500'
                        )}
                      >
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map(e => (
                          <div
                            key={e.id}
                            className="truncate rounded bg-blue-500/20 px-1 py-0.5 text-[9px] font-medium text-blue-400"
                            title={`${e.summary} — ${formatTime(e.start)}`}
                          >
                            {formatTime(e.start) !== 'All day' && (
                              <span className="mr-1 opacity-70">{formatTime(e.start)}</span>
                            )}
                            {e.summary}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] text-zinc-600 pl-1">+{dayEvents.length - 2} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Today's events list */}
        {events.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Today's Events
            </h2>
            <div className="space-y-2">
              {events.map(event => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
                >
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100">{event.summary}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{formatTimeFull(event.start)}</p>
                    {event.location && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-zinc-600">
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

        {events.length === 0 && !data?.calendar?.error && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-8 text-center">
            <p className="text-sm text-zinc-500">No events found for today.</p>
            <p className="mt-1 text-xs text-zinc-600">Navigate the calendar above to see upcoming events.</p>
          </div>
        )}

      </div>
    </div>
  )
}
