"use client";

import { useMemo } from "react";
import type { Task, Deadline, Shoot, CulturalEvent } from "./types";

interface Props {
  tasks: Task[];
  deadlines: Deadline[];
  shoots: Shoot[];
  culturalEvents: CulturalEvent[];
}

const DAY_MS = 86_400_000;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function WeekStrip({ tasks, deadlines, shoots, culturalEvents }: Props) {
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start.getTime() + i * DAY_MS);

      const taskCount = tasks.filter(
        (t) => t.dueDate && t.status !== "DONE" && sameDay(new Date(t.dueDate), date),
      ).length;
      const deadlineCount = deadlines.filter(
        (d) => d.status !== "COMPLETED" && sameDay(new Date(d.dueDate), date),
      ).length;
      const shootCount = shoots.filter((s) => sameDay(new Date(s.date), date)).length;
      const eventCount = culturalEvents.filter((e) => sameDay(new Date(e.date), date)).length;

      return {
        date,
        isToday: i === 0,
        taskCount: taskCount + deadlineCount,
        shootCount,
        eventCount,
      };
    });
  }, [tasks, deadlines, shoots, culturalEvents]);

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((d, i) => (
        <div
          key={i}
          className={`flex flex-col items-center rounded-xl border px-1 py-2 ${
            d.isToday
              ? "border-[#D4A853] bg-[#D4A853]/10"
              : "border-gray-100 bg-gray-50/60"
          }`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {WEEKDAYS[d.date.getDay()]}
          </span>
          <span
            className={`mt-0.5 text-sm font-bold ${
              d.isToday ? "text-[#9a7322]" : "text-gray-700"
            }`}
          >
            {d.date.getDate()}
          </span>
          <div className="mt-1.5 flex h-2 items-center gap-0.5">
            {d.taskCount > 0 && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-gray-400"
                title={`${d.taskCount} due`}
              />
            )}
            {d.shootCount > 0 && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-blue-500"
                title={`${d.shootCount} shoot`}
              />
            )}
            {d.eventCount > 0 && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-purple-400"
                title={`${d.eventCount} event`}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
