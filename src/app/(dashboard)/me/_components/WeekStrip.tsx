"use client";

import { useMemo } from "react";
import type { CulturalEvent, Shoot, Task } from "./types";

interface Props {
  tasks: Task[];
  shoots: Shoot[];
  culturalEvents: CulturalEvent[];
}

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Current week, Monday to Sunday, with dots for tasks, shoots and events.
export function WeekStrip({ tasks, shoots, culturalEvents }: Props) {
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Monday of the current week (getDay(): Sun=0 ... Sat=6).
    const monday = new Date(today.getTime() - ((today.getDay() + 6) % 7) * DAY_MS);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday.getTime() + i * DAY_MS);

      const dueTasks = tasks.filter(
        (t) => t.dueDate && t.status !== "DONE" && sameDay(new Date(t.dueDate), date)
      );
      const dayShoots = shoots.filter((s) => sameDay(new Date(s.date), date));
      const dayEvents = culturalEvents.filter((e) => sameDay(new Date(e.date), date));

      return {
        date,
        isToday: sameDay(date, today),
        taskCount: dueTasks.length,
        taskTitle: dueTasks.map((t) => t.title).join(", "),
        shootCount: dayShoots.length,
        shootTitle: dayShoots.map((s) => s.title).join(", "),
        eventCount: dayEvents.length,
        eventTitle: dayEvents.map((e) => e.title).join(", "),
      };
    });
  }, [tasks, shoots, culturalEvents]);

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div
            key={i}
            className={`flex flex-col items-center rounded-lg px-1 py-2 ${
              d.isToday ? "bg-[#ffd700]/10 ring-1 ring-[#ffd700]" : ""
            }`}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {WEEKDAYS[i]}
            </span>
            <span
              className={`mt-0.5 text-sm font-bold ${
                d.isToday ? "text-[#e6c200]" : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {d.date.getDate()}
            </span>
            <div className="mt-1 flex h-1.5 items-center gap-0.5">
              {d.taskCount > 0 && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#ffd700]"
                  title={d.taskTitle || `${d.taskCount} due`}
                />
              )}
              {d.shootCount > 0 && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#ff4444]"
                  title={d.shootTitle || `${d.shootCount} shoot`}
                />
              )}
              {d.eventCount > 0 && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-purple-400"
                  title={d.eventTitle || `${d.eventCount} event`}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
