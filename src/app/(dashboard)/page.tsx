"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useMemo } from "react";

type EventCategory = "commercial" | "production" | "print" | "finance" | "events";

interface CalEvent {
  title: string;
  category: EventCategory;
}

type EventMap = Record<string, CalEvent[]>;

const DOT_COLOR: Record<EventCategory, string> = {
  commercial: "bg-blue-500",
  production: "bg-purple-500",
  print: "bg-pink-500",
  finance: "bg-green-500",
  events: "bg-orange-400",
};

const CATEGORY_LABEL: Record<EventCategory, string> = {
  commercial: "Commercial",
  production: "Production",
  print: "Print",
  finance: "Finance",
  events: "Events",
};

const CATEGORY_PILL: Record<EventCategory, string> = {
  commercial: "bg-blue-50 text-blue-700",
  production: "bg-purple-50 text-purple-700",
  print: "bg-pink-50 text-pink-700",
  finance: "bg-green-50 text-green-700",
  events: "bg-orange-50 text-orange-700",
};

function buildEvents(): EventMap {
  const ev: EventMap = {};
  const add = (d: string, title: string, category: EventCategory) => {
    if (!ev[d]) ev[d] = [];
    ev[d].push({ title, category });
  };

  // Payroll: 25th every month
  for (let m = 1; m <= 12; m++) {
    add(`2026-${String(m).padStart(2, "0")}-25`, "Payroll", "finance");
  }

  // VAT: 7th of Jan, Apr, Jul, Oct
  for (const m of ["01", "04", "07", "10"]) {
    add(`2026-${m}-07`, "VAT Return", "finance");
  }

  // Commercial
  add("2026-01-15", "Spring Campaign Brief", "commercial");
  add("2026-02-01", "Valentine Campaign Live", "commercial");
  add("2026-03-01", "Spring Campaign Launch", "commercial");
  add("2026-03-31", "Q1 IO Signing", "commercial");
  add("2026-04-15", "Summer Campaign Brief", "commercial");
  add("2026-05-01", "Summer Campaign Launch", "commercial");
  add("2026-06-30", "H1 Campaign Wrap", "commercial");
  add("2026-07-15", "Autumn Campaign Brief", "commercial");
  add("2026-09-01", "Autumn Campaign Launch", "commercial");
  add("2026-10-31", "Q4 IO Signing", "commercial");
  add("2026-11-01", "Christmas Campaign Launch", "commercial");
  add("2026-12-15", "Year-End Campaign Close", "commercial");

  // Production
  add("2026-02-10", "SS26 Cover Shoot", "production");
  add("2026-04-14", "Spring Editorial Shoot", "production");
  add("2026-05-20", "Campaign Shoot H1", "production");
  add("2026-07-08", "Summer Shoot", "production");
  add("2026-08-25", "AW26 Cover Shoot", "production");
  add("2026-10-05", "Autumn Editorial Shoot", "production");
  add("2026-11-18", "Christmas Shoot", "production");

  // Print
  add("2026-01-31", "Issue 1 Copy Deadline", "print");
  add("2026-02-28", "Issue 1 Print Deadline", "print");
  add("2026-04-30", "Issue 2 Copy Deadline", "print");
  add("2026-05-31", "Issue 2 Print Deadline", "print");
  add("2026-07-31", "Issue 3 Copy Deadline", "print");
  add("2026-08-31", "Issue 3 Print Deadline", "print");
  add("2026-10-30", "Issue 4 Copy Deadline", "print");
  add("2026-11-30", "Issue 4 Print Deadline", "print");

  // Events
  add("2026-02-14", "Valentine Pop-Up", "events");
  add("2026-03-20", "Spring Industry Event", "events");
  add("2026-06-15", "Summer Party", "events");
  add("2026-09-10", "Autumn Industry Event", "events");
  add("2026-10-15", "Brand Summit", "events");
  add("2026-12-10", "Christmas Party", "events");

  return ev;
}

const SAMPLE_EVENTS = buildEvents();

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOffset(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Mon=0 … Sun=6
}

function toKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function greeting(name?: string | null): string {
  const h = new Date().getHours();
  const t = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `Good ${t}${name ? `, ${name.split(" ")[0]}` : ""}`;
}

interface DayModalProps {
  dateKey: string;
  events: CalEvent[];
  onClose: () => void;
}

function DayModal({ dateKey, events, onClose }: DayModalProps) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const label = new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              {label}
            </p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">
              {events.length} {events.length === 1 ? "item" : "items"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            ×
          </button>
        </div>
        <ul className="space-y-2">
          {events.map((ev, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[ev.category]}`} />
              <span className="flex-1 text-sm text-gray-800">{ev.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_PILL[ev.category]}`}>
                {CATEGORY_LABEL[ev.category]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface MonthCardProps {
  year: number;
  monthIndex: number;
  events: EventMap;
  today: { year: number; month: number; day: number };
  onDayClick: (key: string) => void;
}

function MonthCard({ year, monthIndex, events, today, onDayClick }: MonthCardProps) {
  const total = daysInMonth(year, monthIndex);
  const offset = firstDayOffset(year, monthIndex);
  const cells = Array(offset).fill(null).concat(
    Array.from({ length: total }, (_, i) => i + 1)
  );
  // Pad to complete rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="card-apple rounded-2xl p-4 transition-all duration-200">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">
        {MONTHS[monthIndex]}
      </p>
      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7">
        {DAY_LABELS.map((d, i) => (
          <span key={i} className="text-center text-[9px] font-semibold text-gray-300">
            {d}
          </span>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const key = toKey(year, monthIndex, day);
          const dayEvents = events[key] ?? [];
          const isToday =
            today.year === year &&
            today.month === monthIndex &&
            today.day === day;
          const hasEvents = dayEvents.length > 0;
          const cats = [...new Set(dayEvents.map((e) => e.category))].slice(0, 3);

          return (
            <button
              key={i}
              onClick={() => hasEvents && onDayClick(key)}
              className={`flex flex-col items-center rounded-lg py-0.5 transition-all duration-150 ${
                hasEvents ? "cursor-pointer hover:bg-gray-50" : "cursor-default"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium leading-none transition-colors ${
                  isToday
                    ? "bg-[#D4A853] text-white font-bold"
                    : "text-gray-700"
                }`}
              >
                {day}
              </span>
              <div className="mt-0.5 flex gap-0.5">
                {cats.map((cat, ci) => (
                  <span key={ci} className={`h-1 w-1 rounded-full ${DOT_COLOR[cat]}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarWelcomePage() {
  const { data: session } = useSession();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };

  const selectedEvents = useMemo(
    () => (selectedDay ? SAMPLE_EVENTS[selectedDay] ?? [] : []),
    [selectedDay]
  );

  const legend: { category: EventCategory; label: string }[] = [
    { category: "commercial", label: "Commercial" },
    { category: "production", label: "Production" },
    { category: "print", label: "Print" },
    { category: "finance", label: "Finance" },
    { category: "events", label: "Events" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <div className="border-b border-gray-100 bg-white px-8 py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-gray-900">
              Outlander<span className="text-[#D4A853]">OS</span>
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
              2026
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">{greeting(session?.user?.name)}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-8 py-8">
        {/* Legend */}
        <div className="mb-8 flex flex-wrap items-center gap-5">
          {legend.map(({ category, label }) => (
            <div key={category} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${DOT_COLOR[category]}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Year grid — 4×3 */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => (
            <MonthCard
              key={i}
              year={2026}
              monthIndex={i}
              events={SAMPLE_EVENTS}
              today={today}
              onDayClick={setSelectedDay}
            />
          ))}
        </div>

        {/* Clock In CTA */}
        <div className="mt-12 flex flex-col items-center gap-3">
          <Link
            href="/hub"
            className="inline-flex items-center gap-2.5 rounded-2xl bg-[#D4A853] px-8 py-3.5 text-sm font-bold text-white shadow-md shadow-amber-200/60 transition-all duration-200 hover:bg-[#C49843] hover:shadow-lg hover:shadow-amber-200/80 active:scale-95"
          >
            Clock In — Open Portal
          </Link>
          <p className="text-xs text-gray-400">Enter the hub to start your day</p>
        </div>
      </div>

      {/* Day modal */}
      {selectedDay && selectedEvents.length > 0 && (
        <DayModal
          dateKey={selectedDay}
          events={selectedEvents}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
