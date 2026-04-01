"use client";

import { useState } from "react";
import {
  Bell,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Category = "financial" | "payroll" | "legal" | "operational" | "campaign";
type Frequency = "one-off" | "monthly" | "quarterly" | "annually";
type ReminderStatus = "overdue" | "upcoming" | "completed";

type Reminder = {
  id: number;
  title: string;
  category: Category;
  dueDate: string;
  dueDateObj: Date;
  frequency: Frequency;
  status: ReminderStatus;
  description: string;
};

const CATEGORY_CONFIG: Record<
  Category,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  financial: {
    label: "Financial",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
  },
  payroll: {
    label: "Payroll",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    dot: "bg-blue-400",
  },
  legal: {
    label: "Legal/Compliance",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    dot: "bg-red-400",
  },
  operational: {
    label: "Operational",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  campaign: {
    label: "Campaign",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    dot: "bg-purple-400",
  },
};

function generateCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const startOffset = (startDow + 6) % 7;
  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [calendarMonth, setCalendarMonth] = useState({ year: 2026, month: 3 });

  const filtered = reminders.filter((r) => {
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    return true;
  });

  const overdue = filtered.filter((r) => r.status === "overdue");
  const upcoming = filtered.filter((r) => r.status === "upcoming");

  const calDays = generateCalendar(calendarMonth.year, calendarMonth.month);

  const getRemindersForDay = (day: number) =>
    reminders.filter((r) => {
      return (
        r.dueDateObj.getFullYear() === calendarMonth.year &&
        r.dueDateObj.getMonth() === calendarMonth.month &&
        r.dueDateObj.getDate() === day
      );
    });

  const prevMonth = () =>
    setCalendarMonth((prev) => ({
      month: prev.month === 0 ? 11 : prev.month - 1,
      year: prev.month === 0 ? prev.year - 1 : prev.year,
    }));

  const nextMonth = () =>
    setCalendarMonth((prev) => ({
      month: prev.month === 11 ? 0 : prev.month + 1,
      year: prev.month === 11 ? prev.year + 1 : prev.year,
    }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-100">Reminders</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-md border border-neutral-800">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                viewMode === "list"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                viewMode === "calendar"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </button>
          </div>

          <Button size="sm" className="bg-[#D4A853] text-black hover:bg-[#c49a47]">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Reminder
          </Button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setCategoryFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            categoryFilter === "all"
              ? "border-neutral-600 bg-neutral-800 text-white"
              : "border-neutral-800 text-neutral-500 hover:text-neutral-300"
          )}
        >
          All
        </button>
        {(Object.keys(CATEGORY_CONFIG) as Category[]).map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                categoryFilter === cat
                  ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                  : "border-neutral-800 text-neutral-500 hover:text-neutral-300"
              )}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* List View */}
      {viewMode === "list" && (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Overdue</span>
              </div>
              {overdue.map((r) => (
                <ReminderRow key={r.id} reminder={r} />
              ))}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-neutral-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Upcoming</span>
              </div>
              {upcoming.map((r) => (
                <ReminderRow key={r.id} reminder={r} />
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-800 py-16 text-center">
              <Bell className="mx-auto mb-3 h-8 w-8 text-neutral-700" />
              <p className="text-sm text-neutral-500">No reminders yet</p>
              <p className="mt-1 text-xs text-neutral-700">
                Add reminders for Financial, Payroll, Legal/Compliance, Operational, and Campaign deadlines
              </p>
              <button className="mt-4 text-xs text-[#D4A853] hover:underline">
                + Add your first reminder
              </button>
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <button
              onClick={prevMonth}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-neutral-200">
              {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
            </span>
            <button
              onClick={nextMonth}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-neutral-800">
            {DOW_LABELS.map((d) => (
              <div key={d} className="py-2 text-center text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calDays.map((day, i) => {
              const dayReminders = day ? getRemindersForDay(day) : [];
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[80px] border-b border-r border-neutral-800 p-1.5",
                    !day && "bg-neutral-950/50",
                    i % 7 === 6 && "border-r-0"
                  )}
                >
                  {day && (
                    <>
                      <span className="mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs text-neutral-500">
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {dayReminders.map((r) => {
                          const cfg = CATEGORY_CONFIG[r.category];
                          return (
                            <div
                              key={r.id}
                              className={cn(
                                "truncate rounded px-1 py-0.5 text-[9px] font-medium",
                                r.status === "overdue"
                                  ? "bg-red-500/20 text-red-400"
                                  : `${cfg.bg} ${cfg.color}`
                              )}
                            >
                              {r.title}
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
      )}
    </div>
  );
}

function ReminderRow({ reminder: r }: { reminder: Reminder }) {
  const cfg = CATEGORY_CONFIG[r.category];
  const isOverdue = r.status === "overdue";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3.5 transition-colors hover:border-neutral-700",
        isOverdue
          ? "border-red-800/40 bg-red-900/5"
          : "border-neutral-800 bg-neutral-900"
      )}
    >
      <div className={cn("mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full", isOverdue ? "bg-red-400" : cfg.dot)} />
      <div className="flex-1 space-y-1">
        <p className={cn("text-sm font-medium", isOverdue ? "text-red-300" : "text-neutral-200")}>
          {r.title}
        </p>
        <p className="text-xs text-neutral-500">{r.description}</p>
        <div className="flex items-center gap-3">
          <span className={cn("text-xs font-medium", isOverdue ? "text-red-400" : "text-neutral-400")}>
            Due: {r.dueDate}
          </span>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px]", cfg.border, cfg.color, cfg.bg)}>
            {cfg.label}
          </span>
          <span className="rounded-full border border-neutral-800 px-2 py-0.5 text-[10px] capitalize text-neutral-500">
            {r.frequency}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Bell className="h-3.5 w-3.5 text-neutral-600" />
        <button className="rounded-full border border-neutral-700 px-2.5 py-1 text-[10px] text-neutral-400 hover:border-neutral-600 hover:text-neutral-200">
          Mark done
        </button>
      </div>
    </div>
  );
}
