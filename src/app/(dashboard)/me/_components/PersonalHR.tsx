"use client";

import Link from "next/link";
import { Plane, CalendarClock } from "lucide-react";
import type { Holiday } from "./types";

interface Props {
  holiday: Holiday;
}

const DAY_MS = 86_400_000;

function daysUntil(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / DAY_MS);
}

// Payroll runs on the 25th of every month.
function nextPayroll(): Date {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 25);
  if (daysUntil(thisMonth) >= 0) return thisMonth;
  return new Date(now.getFullYear(), now.getMonth() + 1, 25);
}

function countdownLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

function formatRange(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const start = new Date(startIso).toLocaleDateString("en-GB", opts);
  const end = new Date(endIso).toLocaleDateString("en-GB", opts);
  return start === end ? start : `${start} – ${end}`;
}

// Personal HR — holiday balance and the next payroll countdown, grouped in the
// right sidebar. Payroll moved here out of the Business Pulse KPI cards.
export function PersonalHR({ holiday }: Props) {
  const payroll = nextPayroll();
  const payrollDays = daysUntil(payroll);

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">HR</h2>

      {/* Holiday */}
      <Link
        href="/me/holiday"
        className="mt-2 flex items-center gap-3 rounded-lg py-2 transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#9C7C2E]/10 dark:bg-[#C9A44A]/10 text-[#9C7C2E] dark:text-[#C9A44A]">
          <Plane className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Holiday balance
          </span>
          <span className="block text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">
            {holiday.remaining}
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500"> / {holiday.allowance} days</span>
          </span>
          <span className="block truncate text-[11px] text-gray-400 dark:text-gray-500">
            {holiday.nextHoliday
              ? `Next: ${formatRange(holiday.nextHoliday.startDate, holiday.nextHoliday.endDate)}`
              : "No holiday booked"}
          </span>
        </span>
      </Link>

      {/* Payroll */}
      <div className="mt-1 flex items-center gap-3 border-t border-gray-50 pt-3 dark:border-gray-800">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          <CalendarClock className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Next payroll
          </span>
          <span className="block text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">
            {countdownLabel(payrollDays)}
          </span>
          <span className="block text-[11px] text-gray-400 dark:text-gray-500">
            {payroll.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
          </span>
        </span>
      </div>
    </section>
  );
}
