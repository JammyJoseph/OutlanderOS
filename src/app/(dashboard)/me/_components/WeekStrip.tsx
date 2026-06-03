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

      const dueTasks = tasks.filter(
        (t) => t.dueDate && t.status !== "DONE" && sameDay(new Date(t.dueDate), date)
      );
      const dueDeadlines = deadlines.filter(
        (d) => d.status !== "COMPLETED" && sameDay(new Date(d.dueDate), date)
      );

      const startDeadlines = deadlines.filter(
        (d) =>
          d.startDate &&
          d.status !== "COMPLETED" &&
          sameDay(new Date(d.startDate), date)
      );

      const dueLabels = [
        ...dueTasks.map((t) => t.title),
        ...dueDeadlines.map((d) => d.title),
      ];
      const startLabels = startDeadlines.map((d) => `Start: ${d.title}`);

      const shootCount = shoots.filter((s) => sameDay(new Date(s.date), date)).length;
      const shootLabels = shoots
        .filter((s) => sameDay(new Date(s.date), date))
        .map((s) => s.title);
      const eventCount = culturalEvents.filter((e) =>
        sameDay(new Date(e.date), date)
      ).length;
      const eventLabels = culturalEvents
        .filter((e) => sameDay(new Date(e.date), date))
        .map((e) => e.title);

      return {
        date,
        isToday: i === 0,
        dueCount: dueLabels.length,
        dueTitle: dueLabels.join(", "),
        startCount: startLabels.length,
        startTitle: startLabels.join(", "),
        shootCount,
        shootTitle: shootLabels.join(", "),
        eventCount,
        eventTitle: eventLabels.join(", "),
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
            {d.dueCount > 0 && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-gray-400"
                title={d.dueTitle || `${d.dueCount} due`}
              />
            )}
            {d.startCount > 0 && (
              <span
                className="h-1.5 w-1.5 rounded-full border border-blue-400 bg-transparent"
                title={d.startTitle || `${d.startCount} starting`}
              />
            )}
            {d.shootCount > 0 && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-blue-500"
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
  );
}
