"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths } from "date-fns";

const events = [
  { date: new Date(2026, 2, 31), title: "Weekly team standup", type: "internal", time: "09:00" },
  { date: new Date(2026, 2, 31), title: "ASOS partnership call", type: "external", time: "11:00" },
  { date: new Date(2026, 2, 31), title: "April issue review", type: "internal", time: "13:30" },
  { date: new Date(2026, 3, 3), title: "April issue deadline", type: "deadline", time: "All day" },
  { date: new Date(2026, 3, 4), title: "Hackney Wick shoot – Day 1", type: "production", time: "08:00" },
  { date: new Date(2026, 3, 5), title: "Hackney Wick shoot – Day 2", type: "production", time: "08:00" },
  { date: new Date(2026, 3, 7), title: "VAT return deadline", type: "compliance", time: "All day" },
  { date: new Date(2026, 3, 10), title: "Callum probation review", type: "hr", time: "14:00" },
  { date: new Date(2026, 3, 12), title: "ASOS brief due", type: "deadline", time: "All day" },
  { date: new Date(2026, 3, 15), title: "Monthly payroll", type: "finance", time: "All day" },
  { date: new Date(2026, 3, 22), title: "Board meeting", type: "internal", time: "10:00" },
];

const typeColors: Record<string, string> = {
  internal: "bg-blue-500",
  external: "bg-emerald-500",
  deadline: "bg-red-500",
  production: "bg-purple-500",
  compliance: "bg-amber-500",
  finance: "bg-[#D4A853]",
  hr: "bg-pink-500",
};

const typeBadge: Record<string, string> = {
  internal: "bg-blue-500/20 text-blue-400",
  external: "bg-emerald-500/20 text-emerald-400",
  deadline: "bg-red-500/20 text-red-400",
  production: "bg-purple-500/20 text-purple-400",
  compliance: "bg-amber-500/20 text-amber-400",
  finance: "bg-[#D4A853]/20 text-[#D4A853]",
  hr: "bg-pink-500/20 text-pink-400",
};

export default function CalendarPage() {
  const [current, setCurrent] = useState(new Date(2026, 2, 31));
  const today = new Date(2026, 2, 31);

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart); // 0=Sun

  const todayEvents = events.filter((e) => isSameDay(e.date, today));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrent(subMonths(current, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-700 text-neutral-400 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-32 text-center text-sm font-medium text-neutral-200">
            {format(current, "MMMM yyyy")}
          </span>
          <button
            onClick={() => setCurrent(addMonths(current, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-700 text-neutral-400 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Calendar grid */}
        <div className="lg:col-span-2">
          <Card className="border-neutral-800 bg-neutral-900">
            <CardContent className="p-4">
              {/* Day headers */}
              <div className="mb-2 grid grid-cols-7 text-center">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-1 text-[11px] text-neutral-500">{d}</div>
                ))}
              </div>
              {/* Days grid */}
              <div className="grid grid-cols-7">
                {Array.from({ length: startPad }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {days.map((day) => {
                  const dayEvents = events.filter((e) => isSameDay(e.date, day));
                  const isToday = isSameDay(day, today);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[64px] rounded-md p-1.5 ${isToday ? "bg-neutral-800" : "hover:bg-neutral-800/50"}`}
                    >
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                          isToday
                            ? "bg-[#D4A853] font-bold text-black"
                            : "text-neutral-400"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 2).map((e, i) => (
                          <div
                            key={i}
                            className={`truncate rounded px-1 py-0.5 text-[9px] text-white ${typeColors[e.type] ?? "bg-neutral-600"}`}
                          >
                            {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] text-neutral-500">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's events */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300">
            Today — {format(today, "MMMM d")}
          </h2>
          {todayEvents.map((e, i) => (
            <Card key={i} className="border-neutral-800 bg-neutral-900">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-200">{e.title}</p>
                  <Badge className={`shrink-0 text-[10px] ${typeBadge[e.type] ?? ""}`}>
                    {e.type}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-neutral-500">{e.time}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
