"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Film,
  Check,
  Clapperboard,
  Flag,
  Circle,
} from "lucide-react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isToday,
} from "date-fns";
import { billingTheme, EDITORIAL_HEX, PAID_HEX } from "./billing";

// ─── Shapes the calendar consumes ────────────────────────────────────────────

export interface CalProduction {
  id: string;
  title: string;
  billingType?: string | null;
  type?: string | null;
  shootDates: string[];
  callSheets: { id: string; shootDate: string }[];
  milestones?: {
    id: string;
    date: string;
    title: string;
    done: boolean;
    isMilestone: boolean;
  }[];
}

type EventKind = "shoot" | "milestone" | "task";

interface CalEvent {
  key: string; // unique per event
  productionId: string;
  productionTitle: string;
  hex: string;
  kind: EventKind;
  title: string;
  done: boolean;
  date: Date;
  callSheetId?: string;
  milestoneId?: string;
}

type ViewMode = "month" | "week" | "day";

function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// Flatten every production into dated calendar events.
function buildEvents(productions: CalProduction[]): CalEvent[] {
  const events: CalEvent[] = [];
  for (const p of productions) {
    const hex = billingTheme(p).hex;
    const seenShootDays = new Set<string>();

    for (const cs of p.callSheets ?? []) {
      const d = parseISO(cs.shootDate);
      const k = dayKey(d);
      seenShootDays.add(k);
      events.push({
        key: `shoot-cs-${cs.id}`,
        productionId: p.id,
        productionTitle: p.title,
        hex,
        kind: "shoot",
        title: "Shoot",
        done: false,
        date: d,
        callSheetId: cs.id,
      });
    }
    for (const sd of p.shootDates ?? []) {
      const d = parseISO(sd);
      const k = dayKey(d);
      if (seenShootDays.has(k)) continue; // already covered by a call sheet
      seenShootDays.add(k);
      events.push({
        key: `shoot-sd-${p.id}-${k}`,
        productionId: p.id,
        productionTitle: p.title,
        hex,
        kind: "shoot",
        title: "Shoot",
        done: false,
        date: d,
      });
    }
    for (const m of p.milestones ?? []) {
      const d = parseISO(m.date);
      events.push({
        key: `m-${m.id}`,
        productionId: p.id,
        productionTitle: p.title,
        hex,
        kind: m.isMilestone ? "milestone" : "task",
        title: m.title,
        done: m.done,
        date: d,
        milestoneId: m.id,
      });
    }
  }
  return events;
}

// Small shape marker: shoot = filled square, milestone = diamond, task = circle.
function EventGlyph({ kind, hex, done }: { kind: EventKind; hex: string; done: boolean }) {
  const style = { backgroundColor: done ? "transparent" : hex, borderColor: hex };
  if (kind === "milestone") {
    return (
      <span
        className="inline-block w-2 h-2 rotate-45 border shrink-0"
        style={style}
        aria-hidden
      />
    );
  }
  if (kind === "shoot") {
    return <span className="inline-block w-2 h-2 rounded-[2px] shrink-0" style={{ backgroundColor: hex }} aria-hidden />;
  }
  return (
    <span
      className="inline-block w-2 h-2 rounded-full border shrink-0"
      style={style}
      aria-hidden
    />
  );
}

export default function DashboardCalendar({
  productions,
  onToggleDone,
}: {
  productions: CalProduction[];
  onToggleDone: (productionId: string, milestoneId: string, done: boolean) => void;
}) {
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const events = useMemo(() => buildEvents(productions), [productions]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const k = dayKey(e.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    // Sort within a day: shoots first, then milestones, then tasks.
    const order: Record<EventKind, number> = { shoot: 0, milestone: 1, task: 2 };
    for (const list of map.values()) {
      list.sort((a, b) => order[a.kind] - order[b.kind] || a.productionTitle.localeCompare(b.productionTitle));
    }
    return map;
  }, [events]);

  // Days rendered for the current view.
  const days = useMemo(() => {
    if (view === "day") return [cursor];
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      const e = endOfWeek(cursor, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: s, end: e });
    }
    const s = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const e = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: s, end: e });
  }, [view, cursor]);

  function nav(dir: 1 | -1) {
    setSelectedKey(null);
    if (view === "month") setCursor((c) => (dir === 1 ? addMonths(c, 1) : subMonths(c, 1)));
    else if (view === "week") setCursor((c) => (dir === 1 ? addWeeks(c, 1) : subWeeks(c, 1)));
    else setCursor((c) => (dir === 1 ? addDays(c, 1) : subDays(c, 1)));
  }

  const heading =
    view === "day"
      ? format(cursor, "EEEE d MMMM yyyy")
      : view === "week"
      ? `${format(startOfWeek(cursor, { weekStartsOn: 1 }), "d MMM")} – ${format(
          endOfWeek(cursor, { weekStartsOn: 1 }),
          "d MMM yyyy"
        )}`
      : format(cursor, "MMMM yyyy");

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const selected = selectedKey ? byDay.get(selectedKey) ?? [] : [];
  const maxChips = view === "week" ? 6 : 3;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Header: title + view toggle + nav */}
      <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarIcon size={16} className="text-[#9C7C2E]" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{heading}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-gray-200 dark:border-gray-700 p-0.5">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  setSelectedKey(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                  view === v
                    ? "bg-[#9C7C2E] text-black"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setCursor(new Date());
              setSelectedKey(null);
            }}
            className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => nav(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => nav(1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-5 py-2 border-b border-gray-50 dark:border-gray-800 flex items-center gap-4 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: EDITORIAL_HEX }} /> Editorial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PAID_HEX }} /> Paid
        </span>
        <span className="w-px h-3 bg-gray-200 dark:bg-gray-700" />
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-[2px] bg-gray-400" /> Shoot
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rotate-45 bg-gray-400" /> Milestone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full border border-gray-400" /> Task
        </span>
      </div>

      {/* Day view: full agenda */}
      {view === "day" ? (
        <div className="p-5">
          <DayAgenda
            events={byDay.get(dayKey(cursor)) ?? []}
            onToggleDone={onToggleDone}
          />
        </div>
      ) : (
        <>
          {/* Weekday labels */}
          <div className="px-3 pt-3 grid grid-cols-7">
            {dayLabels.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 py-1 uppercase tracking-wide"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="px-3 pb-3 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const k = dayKey(day);
              const list = byDay.get(k) ?? [];
              const inMonth = view === "week" || isSameMonth(day, cursor);
              const current = isToday(day);
              const isSelected = selectedKey === k;
              return (
                <button
                  key={k}
                  onClick={() => setSelectedKey(isSelected ? null : list.length ? k : null)}
                  className={`text-left flex flex-col rounded-lg border p-1.5 transition-all ${
                    view === "week" ? "min-h-[140px]" : "min-h-[86px]"
                  } ${
                    isSelected
                      ? "border-[#9C7C2E] bg-amber-50/60 dark:bg-amber-900/20"
                      : "border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <span
                    className={`text-xs font-semibold leading-none mb-1 inline-flex items-center justify-center h-5 w-5 rounded-full ${
                      current
                        ? "bg-[#9C7C2E] text-black"
                        : !inMonth
                        ? "text-gray-300 dark:text-gray-600"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="flex flex-col gap-0.5 w-full">
                    {list.slice(0, maxChips).map((e) => (
                      <span
                        key={e.key}
                        className={`flex items-center gap-1 text-[10px] leading-tight rounded px-1 py-0.5 truncate ${
                          e.done ? "opacity-40 line-through" : ""
                        } bg-gray-50 dark:bg-gray-800`}
                        title={`${e.productionTitle} — ${e.title}`}
                      >
                        <EventGlyph kind={e.kind} hex={e.hex} done={e.done} />
                        <span className="truncate text-gray-700 dark:text-gray-300">
                          {e.kind === "shoot" ? e.productionTitle : e.title}
                        </span>
                      </span>
                    ))}
                    {list.length > maxChips && (
                      <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 px-1">
                        +{list.length - maxChips} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected-day expansion */}
          {selectedKey && (
            <div className="px-5 py-4 border-t border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                {format(parseISO(selectedKey), "EEEE d MMMM")}
              </p>
              <DayAgenda events={selected} onToggleDone={onToggleDone} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Day agenda — events grouped by project, with inline quick-complete ───────

function DayAgenda({
  events,
  onToggleDone,
}: {
  events: CalEvent[];
  onToggleDone: (productionId: string, milestoneId: string, done: boolean) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; hex: string; events: CalEvent[] }>();
    for (const e of events) {
      if (!map.has(e.productionId))
        map.set(e.productionId, { title: e.productionTitle, hex: e.hex, events: [] });
      map.get(e.productionId)!.events.push(e);
    }
    return Array.from(map.entries());
  }, [events]);

  if (events.length === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 py-2">Nothing scheduled.</p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(([pid, g]) => (
        <div key={pid} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          {/* Project group header — links to the project */}
          <Link
            href={`/production/${pid}`}
            className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.hex }} />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{g.title}</span>
            <Film size={12} className="text-gray-300 dark:text-gray-600 ml-auto shrink-0" />
          </Link>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {g.events.map((e) => (
              <div key={e.key} className="flex items-center gap-2.5 px-3 py-2">
                {e.kind === "shoot" ? (
                  <Clapperboard size={14} className="shrink-0" style={{ color: e.hex }} />
                ) : (
                  <button
                    onClick={() => e.milestoneId && onToggleDone(e.productionId, e.milestoneId, !e.done)}
                    title={e.done ? "Mark not done" : "Mark done"}
                    className={`shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                      e.done
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-gray-300 dark:border-gray-600 hover:border-emerald-400 text-transparent"
                    }`}
                  >
                    <Check size={11} />
                  </button>
                )}
                {e.kind === "milestone" ? (
                  <Flag size={12} className="text-gray-400 dark:text-gray-500 shrink-0" />
                ) : e.kind === "task" ? (
                  <Circle size={10} className="text-gray-300 dark:text-gray-600 shrink-0" />
                ) : null}
                <span
                  className={`text-sm flex-1 min-w-0 truncate ${
                    e.done ? "text-gray-400 dark:text-gray-500 line-through" : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {e.kind === "shoot" ? "Shoot day" : e.title}
                </span>
                {e.kind === "shoot" && e.callSheetId && (
                  <Link
                    href={`/production/${e.productionId}/call-sheets/${e.callSheetId}`}
                    className="text-[11px] font-medium text-[#9C7C2E] hover:underline shrink-0"
                  >
                    Call sheet
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
