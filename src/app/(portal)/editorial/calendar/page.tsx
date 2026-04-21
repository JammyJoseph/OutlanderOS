"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type EventStatus = "confirmed" | "tentative" | "completed";

interface EditorialEvent {
  id: string;
  title: string;
  franchise: string;
  franchiseColor: string;
  date: string;
  venue?: string;
  status: EventStatus;
}

const STATUS_STYLES: Record<EventStatus, { ring: string; label: string }> = {
  confirmed: { ring: "ring-emerald-300", label: "Confirmed" },
  tentative: { ring: "ring-amber-300", label: "Tentative" },
  completed: { ring: "ring-gray-200", label: "Completed" },
};

const FRANCHISE_COLORS: Record<string, { bg: string; text: string }> = {
  "Fashion Week Coverage": { bg: "bg-amber-100", text: "text-amber-800" },
  "Artist Spotlight Series": { bg: "bg-purple-100", text: "text-purple-800" },
  "Cultural Commentary": { bg: "bg-blue-100", text: "text-blue-800" },
  "Street Style": { bg: "bg-green-100", text: "text-green-800" },
};

const DEMO_EVENTS: EditorialEvent[] = [
  { id: "1", title: "May Spotlight: Naomi Asante", franchise: "Artist Spotlight Series", franchiseColor: "purple", date: "2026-05-01", status: "confirmed" },
  { id: "2", title: "Sustainability Essay", franchise: "Cultural Commentary", franchiseColor: "blue", date: "2026-05-15", status: "confirmed" },
  { id: "3", title: "London Spring Streets", franchise: "Street Style", franchiseColor: "green", date: "2026-05-20", venue: "London", status: "confirmed" },
  { id: "4", title: "June Spotlight: TBC", franchise: "Artist Spotlight Series", franchiseColor: "purple", date: "2026-06-01", status: "tentative" },
  { id: "5", title: "Tokyo Summer Streets", franchise: "Street Style", franchiseColor: "green", date: "2026-06-10", venue: "Tokyo", status: "tentative" },
  { id: "6", title: "LFW SS27 Coverage", franchise: "Fashion Week Coverage", franchiseColor: "amber", date: "2026-09-12", venue: "London", status: "confirmed" },
  { id: "7", title: "PFW AW26 Coverage", franchise: "Fashion Week Coverage", franchiseColor: "amber", date: "2026-03-02", venue: "Paris", status: "completed" },
  { id: "8", title: "April Spotlight: Marco Rossi", franchise: "Artist Spotlight Series", franchiseColor: "purple", date: "2026-04-01", status: "completed" },
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function EditorialCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  function eventsForDay(day: number): EditorialEvent[] {
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return DEMO_EVENTS.filter((e) => e.date === ds);
  }

  const cells: (number | null)[] = [
    ...Array(getFirstDayOfMonth(year, month)).fill(null),
    ...Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1),
  ];

  const uniqueFranchises = Object.keys(FRANCHISE_COLORS);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Editorial Calendar</h1>
          <p className="text-xs text-gray-500">Events and deadlines by franchise</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-gray-900">
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Franchise legend */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {uniqueFranchises.map((name) => {
            const c = FRANCHISE_COLORS[name];
            return (
              <span key={name} className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}>
                {name}
              </span>
            );
          })}
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
          {cells.map((day, idx) => {
            const dayEvents = day ? eventsForDay(day) : [];
            return (
              <div key={idx} className={`min-h-[110px] p-2 ${day ? "bg-white" : "bg-gray-50"}`}>
                {day && (
                  <>
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      isToday(day) ? "bg-[#D4A853] text-white" : "text-gray-700"
                    }`}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.map((ev) => {
                        const fc = FRANCHISE_COLORS[ev.franchise] ?? { bg: "bg-gray-100", text: "text-gray-700" };
                        return (
                          <div
                            key={ev.id}
                            title={`${ev.title} · ${ev.franchise}${ev.venue ? ` · ${ev.venue}` : ""}`}
                            className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${fc.bg} ${fc.text} ${ev.status === "tentative" ? "opacity-60" : ""}`}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
