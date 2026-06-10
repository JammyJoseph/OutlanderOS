'use client'

import { useState } from 'react'
import { Users, Mail, Calendar, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---- Team data ----

const TEAM = [
  { name: 'Joe Silver', role: 'Operations & Admin', email: 'silver@outlandermag.com', color: 'bg-[#D4A853]', initials: 'JS' },
  { name: 'Quinn Titsworth', role: 'CEO', email: 'q@outlandermag.com', color: 'bg-blue-500', initials: 'QT' },
  { name: 'Shreeya Patel', role: 'Sales & Partnerships', email: 'shreeya@outlandermag.com', color: 'bg-emerald-500', initials: 'SP' },
  { name: 'Callum', role: 'Content & Social', email: '', color: 'bg-purple-500', initials: 'CA' },
  { name: 'Patricia', role: 'Production Director', email: '', color: 'bg-pink-500', initials: 'PA' },
]

// ---- Helpers ----

function generateCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay()
  const startOffset = (startDow + 6) % 7
  const days: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
  while (days.length % 7 !== 0) days.push(null)
  return days
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ---- Page ----

export default function TeamPage() {
  const [calMonth, setCalMonth] = useState({ year: 2026, month: 3 })
  const [holidayMsg, setHolidayMsg] = useState<string | null>(null)

  const calDays = generateCalendar(calMonth.year, calMonth.month)

  const prevMonth = () =>
    setCalMonth(p => ({ month: p.month === 0 ? 11 : p.month - 1, year: p.month === 0 ? p.year - 1 : p.year }))
  const nextMonth = () =>
    setCalMonth(p => ({ month: p.month === 11 ? 0 : p.month + 1, year: p.month === 11 ? p.year + 1 : p.year }))

  return (
    <div className="space-y-6 px-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500">{TEAM.length} members</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-medium text-black hover:bg-[#c49a47] transition-colors">
          <Plus className="h-3.5 w-3.5" />
          Add Member
        </button>
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEAM.map(member => (
          <div
            key={member.name}
            className="rounded-xl border border-gray-200 bg-white p-4 space-y-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-black', member.color)}>
                {member.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                <p className="text-xs text-gray-500">{member.role}</p>
              </div>
            </div>

            {member.email && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{member.email}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Holiday Calendar */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#D4A853]" />
            <h2 className="text-sm font-semibold text-gray-800">Holiday Calendar</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[130px] text-center text-sm text-gray-700">
              {MONTH_NAMES[calMonth.month]} {calMonth.year}
            </span>
            <button
              onClick={nextMonth}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-200">
          {DOW_LABELS.map(d => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-medium uppercase tracking-wider text-gray-400"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calDays.map((day, i) => {
            const isWeekend = i % 7 >= 5
            return (
              <div
                key={i}
                className={cn(
                  'min-h-[56px] border-b border-r border-gray-200 p-1.5',
                  !day && 'bg-gray-50',
                  isWeekend && day && 'bg-gray-50/60',
                  i % 7 === 6 && 'border-r-0'
                )}
              >
                {day && (
                  <span className="text-xs text-gray-400">{day}</span>
                )}
              </div>
            )
          })}
        </div>

        <div className="border-t border-gray-200 px-4 py-3 text-center text-xs text-gray-400">
          No holidays booked for {MONTH_NAMES[calMonth.month]} {calMonth.year}
        </div>
      </div>

      {/* Holiday Allowance */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#D4A853]" />
            <h2 className="text-sm font-semibold text-gray-800">Holiday Allowance 2026</h2>
          </div>
          <button
            onClick={() => setHolidayMsg('Holiday booking coming soon.')}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Book Holiday
          </button>
        </div>

        {holidayMsg && (
          <div className="border-b border-gray-200 bg-[#D4A853]/10 px-4 py-2 text-xs text-[#D4A853]">
            {holidayMsg}
          </div>
        )}

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-2.5 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-2.5 text-center font-medium text-gray-500">Total Days</th>
              <th className="px-4 py-2.5 text-center font-medium text-gray-500">Used</th>
              <th className="px-4 py-2.5 text-center font-medium text-gray-500">Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {TEAM.map(member => (
              <tr key={member.name} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-black', member.color)}>
                      {member.initials}
                    </div>
                    <span className="text-gray-800">{member.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-center text-gray-500">25</td>
                <td className="px-4 py-2.5 text-center text-gray-500">0</td>
                <td className="px-4 py-2.5 text-center font-medium text-emerald-600">25</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
