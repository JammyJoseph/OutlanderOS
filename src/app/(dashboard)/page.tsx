'use client'

import Link from 'next/link'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

// Returns Mon=0 … Sun=6
function getMonthOffset(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

const VAT_MONTHS = new Set([0, 3, 6, 9]) // Jan, Apr, Jul, Oct

function MonthCard({ month, today }: { month: number; today: Date }) {
  const year = 2026
  const daysInMonth = getDaysInMonth(year, month)
  const offset = getMonthOffset(year, month)

  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="card-apple p-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
        {MONTH_NAMES[month]}
      </p>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-[9px] text-gray-300 text-center font-medium pb-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="aspect-square" />

          const isToday =
            today.getFullYear() === year &&
            today.getMonth() === month &&
            today.getDate() === day
          const isPayroll = day === 25
          const isVat = day === 7 && VAT_MONTHS.has(month)

          return (
            <div key={i} className="flex flex-col items-center py-0.5 gap-px">
              <button
                className={[
                  'w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-medium transition-colors',
                  isToday
                    ? 'bg-amber-500 text-white font-bold'
                    : 'text-gray-600 hover:bg-gray-100',
                ].join(' ')}
                title={`${MONTH_NAMES[month]} ${day}, 2026`}
              >
                {day}
              </button>
              {/* Event dot — always rendered to keep row height stable */}
              <span
                className={[
                  'w-1 h-1 rounded-full',
                  isVat ? 'bg-red-400' : isPayroll ? 'bg-green-400' : 'invisible',
                ].join(' ')}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function YearCalendarPage() {
  const today = new Date()

  return (
    <div className="bg-white rounded-xl min-h-full p-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-sm font-bold tracking-[0.25em] text-gray-500 uppercase font-sans">
          Outlander OS
        </h1>
        <p className="text-7xl font-bold text-gray-100 leading-none select-none font-mono mt-1">
          2026
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mb-8 text-[11px] text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
          Payroll (25th)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          VAT (7th · Q)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-amber-500 shrink-0" />
          Today
        </span>
      </div>

      {/* 4×3 month grid */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {Array.from({ length: 12 }, (_, i) => (
          <MonthCard key={i} month={i} today={today} />
        ))}
      </div>

      {/* Clock In CTA */}
      <div className="flex justify-center">
        <Link href="/hub" className="btn-primary">
          Clock In →
        </Link>
      </div>
    </div>
  )
}
