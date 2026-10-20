"use client";

import { useMemo } from "react";
import type { CulturalEvent, Shoot, Task } from "./types";

interface Props {
  tasks: Task[];
  shoots: Shoot[];
  culturalEvents: CulturalEvent[];
  /** Rendered under the days — the upcoming list. */
  children?: React.ReactNode;
}

const DAY_MS = 86_400_000;
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Current week, Monday to Sunday, with dots for tasks, shoots and events.
export function WeekStrip({ tasks, shoots, culturalEvents, children }: Props) {
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
    <section className="rounded-2xl bg-surface px-6 py-6" aria-label="This week">
      <h2 className="mb-3 text-xl font-semibold">This week</h2>
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((d, i) => {
          const parts = [d.taskTitle && `Due: ${d.taskTitle}`, d.shootTitle && `Shoot: ${d.shootTitle}`, d.eventTitle && `Event: ${d.eventTitle}`].filter(Boolean);
          return (
            <div key={i} className="flex flex-col items-center gap-1" title={parts.join(" · ") || undefined}>
              <span className="text-xs text-muted-foreground" aria-hidden>
                {WEEKDAYS[i]}
              </span>
              <span
                className={`flex size-8 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums ${
                  d.isToday ? "bg-foreground text-background" : i >= 5 ? "text-muted-foreground" : ""
                }`}
                aria-label={d.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) + (parts.length ? `: ${parts.join(", ")}` : "")}
              >
                {d.date.getDate()}
              </span>
              <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                {d.taskCount > 0 && <span className="size-1.5 rounded-full bg-foreground" />}
                {d.shootCount > 0 && <span className="size-1.5 rounded-full bg-[#A93B2E]" />}
                {d.eventCount > 0 && <span className="size-1.5 rounded-full bg-[#6B4E8E]" />}
              </span>
            </div>
          );
        })}
      </div>
      {children}
    </section>
  );
}
