"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PieceStatus = "pitch" | "draft" | "editing" | "published";

interface EditorialPiece {
  id: string;
  title: string;
  writer: string;
  status: PieceStatus;
  deadline: string;
}

const STATUS_STYLES: Record<PieceStatus, { bg: string; text: string; label: string }> = {
  pitch:     { bg: "bg-gray-100",    text: "text-gray-600",    label: "Pitch" },
  draft:     { bg: "bg-blue-100",    text: "text-blue-700",    label: "Draft" },
  editing:   { bg: "bg-amber-100",   text: "text-amber-700",   label: "Editing" },
  published: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Published" },
};

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

const DEMO_PIECES: EditorialPiece[] = [
  { id: "1", title: "Summer Style Guide", writer: "Emma R.", status: "editing",   deadline: "2026-04-15" },
  { id: "2", title: "Profile: Designer X", writer: "Tom H.", status: "draft",     deadline: "2026-04-22" },
  { id: "3", title: "Travel: Bali",        writer: "Sara K.", status: "pitch",    deadline: "2026-04-28" },
  { id: "4", title: "Tech in Fashion",     writer: "James L.", status: "published", deadline: "2026-04-05" },
];

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

  function piecesForDay(day: number): EditorialPiece[] {
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return DEMO_PIECES.filter((p) => p.deadline === ds);
  }

  const cells: (number | null)[] = [
    ...Array(getFirstDayOfMonth(year, month)).fill(null),
    ...Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Editorial Calendar</h1>
          <p className="text-xs text-gray-500">Deadlines, drafts, and publication schedule</p>
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
        {/* Legend */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {(Object.entries(STATUS_STYLES) as [PieceStatus, typeof STATUS_STYLES[PieceStatus]][]).map(([status, s]) => (
            <span key={status} className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>
              {s.label}
            </span>
          ))}
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
            const dayPieces = day ? piecesForDay(day) : [];
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
                      {dayPieces.map((p) => {
                        const s = STATUS_STYLES[p.status];
                        return (
                          <div
                            key={p.id}
                            title={`${p.title} — ${p.writer}`}
                            className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${s.bg} ${s.text}`}
                          >
                            {p.title}
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
