"use client";

import { CalendarDays, Film } from "lucide-react";
import { WeekStrip } from "./WeekStrip";
import type { DashboardData } from "./types";

interface Props {
  data: DashboardData;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const TODAY_LABEL = new Date().toLocaleDateString("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function relativeDays(iso: string): string {
  const day = 86_400_000;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(iso).getTime() - start.getTime()) / day);
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff < 21) return `in ${diff} days`;
  return `in ${Math.round(diff / 7)} weeks`;
}

export function CommandCenter({ data }: Props) {
  const { user, counts, culturalEvents, shoots } = data;
  const firstName = user.name?.split(" ")[0] || "there";
  const nextEvents = culturalEvents.slice(0, 3);
  const nextShoot = shoots[0];

  return (
    <section className="relative grid grid-cols-1 gap-6 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white/80 p-6 shadow-sm backdrop-blur-md lg:grid-cols-[1.5fr_1fr]">
      {/* Decorative gold wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#D4A853]/10 blur-3xl"
      />
      {/* Left — greeting and numbers */}
      <div className="relative flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-0.5 text-sm font-medium text-gray-400">{TODAY_LABEL}</p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Stat label="Overdue" value={counts.overdue} tone="red" />
          <Stat label="Due today" value={counts.today} tone="amber" />
          <Stat label="This week" value={counts.week} tone="gray" />
          <Stat label="In progress" value={counts.inProgress} tone="blue" />
        </div>
      </div>

      {/* Right — week strip, events, next shoot */}
      <div className="relative flex flex-col gap-4 lg:border-l lg:border-[#E5E7EB] lg:pl-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Next 7 days
          </p>
          <WeekStrip
            tasks={data.tasks}
            deadlines={data.deadlines}
            shoots={data.shoots}
            culturalEvents={data.culturalEvents}
          />
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <CalendarDays className="h-3.5 w-3.5" /> Cultural calendar
          </p>
          {nextEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No upcoming events.</p>
          ) : (
            <ul className="space-y-1.5">
              {nextEvents.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-gray-700">{e.title}</span>
                  <span className="shrink-0 text-xs font-medium text-purple-500">
                    {relativeDays(e.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <Film className="h-3.5 w-3.5" /> Next shoot
          </p>
          {nextShoot ? (
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-gray-700">{nextShoot.title}</span>
              <span className="shrink-0 text-xs font-medium text-blue-500">
                {relativeDays(nextShoot.date)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No shoots scheduled.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "gray" | "blue";
}) {
  const tones = {
    red: "border-red-100 bg-red-50 text-red-600",
    amber: "border-[#D4A853]/30 bg-[#D4A853]/10 text-[#9a7322]",
    gray: "border-gray-100 bg-gray-50 text-gray-600",
    blue: "border-blue-100 bg-blue-50 text-blue-600",
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tones[tone]}`}>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}
