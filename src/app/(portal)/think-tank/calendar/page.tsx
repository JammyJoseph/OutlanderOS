"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

type CulturalEvent = {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  category: string;
  subcategory: string | null;
  location: string | null;
  description: string | null;
  importance: number;
  tags: string[];
};

const CATEGORY_STYLES: Record<string, { bg: string; text: string; dot: string; ring: string }> = {
  fashion: { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-400", ring: "ring-amber-200" },
  art: { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-400", ring: "ring-purple-200" },
  film: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-400", ring: "ring-blue-200" },
  music: { bg: "bg-pink-100", text: "text-pink-800", dot: "bg-pink-400", ring: "ring-pink-200" },
  design: { bg: "bg-teal-100", text: "text-teal-800", dot: "bg-teal-400", ring: "ring-teal-200" },
  food: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-400", ring: "ring-green-200" },
  awards: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-400", ring: "ring-yellow-200" },
  culture: { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-400", ring: "ring-orange-200" },
  sport: { bg: "bg-gray-100", text: "text-gray-800", dot: "bg-gray-400", ring: "ring-gray-200" },
  brand: { bg: "bg-indigo-100", text: "text-indigo-800", dot: "bg-indigo-400", ring: "ring-indigo-200" },
};

const CATEGORIES = [
  "fashion",
  "art",
  "film",
  "music",
  "design",
  "food",
  "awards",
  "culture",
  "sport",
  "brand",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function getStyle(category: string) {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES.culture;
}
function formatDateLong(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function CulturalCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CulturalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<Set<string>>(new Set(CATEGORIES));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const monthParam = `${year}-${String(month + 1).padStart(2, "0")}`;
    fetch(`/api/cultural-calendar?month=${monthParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setEvents(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const visibleEvents = useMemo(
    () => events.filter((e) => enabled.has(e.category)),
    [events, enabled]
  );

  const upcoming = useMemo(
    () =>
      [...visibleEvents]
        .filter((e) => new Date(e.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 8),
    [visibleEvents] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function prevMonth() {
    setSelectedDay(null);
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    setSelectedDay(null);
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(today.getDate());
  }

  function eventsForDay(day: number): CulturalEvent[] {
    const target = new Date(year, month, day);
    const t = ymd(target);
    return visibleEvents
      .filter((e) => {
        const start = new Date(e.date);
        const end = e.endDate ? new Date(e.endDate) : start;
        return ymd(start) <= t && t <= ymd(end);
      })
      .sort((a, b) => b.importance - a.importance);
  }

  function toggleCategory(cat: string) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth(year, month)).fill(null),
    ...Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : [];

  return (
    <div className="flex h-full flex-col bg-gray-50 font-[Manrope]">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#E5E7EB] bg-white/80 px-6 py-3 backdrop-blur-md">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="h-2 w-2 rounded-full bg-[#E67E22]" />
            Cultural Calendar
          </h1>
          <p className="text-xs text-gray-500">Fashion weeks, art fairs, film festivals & cultural moments</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Today
          </button>
          <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <span className="min-w-[160px] text-center text-sm font-semibold text-gray-900">
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {CATEGORIES.map((cat) => {
              const s = getStyle(cat);
              const on = enabled.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    on ? `${s.bg} ${s.text} border-transparent` : "border-gray-200 bg-white text-gray-400"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${on ? "" : "opacity-30"}`} />
                  <span className="capitalize">{cat}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-7">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200">
            {cells.map((day, idx) => {
              const dayEvents = day ? eventsForDay(day) : [];
              const visible = dayEvents.slice(0, 3);
              const more = dayEvents.length - visible.length;
              const selected = day && selectedDay === day;
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => day && setSelectedDay(day)}
                  className={`flex min-h-[110px] flex-col items-stretch p-2 text-left transition ${
                    day ? "bg-white hover:bg-[#E67E22]/5" : "bg-gray-50"
                  } ${selected ? "ring-2 ring-[#E67E22]/50" : ""}`}
                >
                  {day && (
                    <>
                      <span
                        className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                          isToday(day) ? "bg-[#E67E22] text-white" : "text-gray-700"
                        }`}
                      >
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {visible.map((ev) => {
                          const s = getStyle(ev.category);
                          return (
                            <span
                              key={ev.id}
                              title={`${ev.title}${ev.location ? ` · ${ev.location}` : ""}`}
                              className={`block truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium ${s.bg} ${s.text}`}
                            >
                              {ev.title}
                            </span>
                          );
                        })}
                        {more > 0 && (
                          <span className="block text-[10px] font-medium text-gray-400">+{more} more</span>
                        )}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDay !== null && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">
                  {DAYS[(firstDayOfMonth(year, month) + selectedDay - 1) % 7]} {selectedDay} {MONTHS[month]} {year}
                </h2>
                <button onClick={() => setSelectedDay(null)} className="text-xs text-gray-400 hover:text-gray-600">
                  Close
                </button>
              </div>
              {selectedDayEvents.length === 0 ? (
                <p className="text-xs text-gray-500">No events on this day.</p>
              ) : (
                <ul className="space-y-2">
                  {selectedDayEvents.map((ev) => {
                    const s = getStyle(ev.category);
                    return (
                      <li key={ev.id} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{ev.title}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${s.bg} ${s.text} capitalize`}>
                              {ev.category}
                            </span>
                            {ev.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {ev.location}
                              </span>
                            )}
                          </div>
                          {ev.description && <p className="mt-1 text-xs text-gray-600">{ev.description}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-5 lg:block">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Upcoming
          </h2>
          {loading ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : upcoming.length === 0 ? (
            <p className="text-xs text-gray-400">No upcoming events match your filters.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((ev) => {
                const s = getStyle(ev.category);
                return (
                  <li key={ev.id} className={`rounded-xl border border-gray-100 p-3 ring-1 ${s.ring}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${s.bg} ${s.text} capitalize`}>
                        {ev.category}
                      </span>
                      <span className="text-[10px] font-medium text-gray-400">
                        {formatDateLong(ev.date)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-gray-900">{ev.title}</p>
                    {ev.location && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                        <MapPin className="h-3 w-3" /> {ev.location}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
