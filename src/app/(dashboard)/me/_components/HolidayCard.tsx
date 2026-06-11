"use client";

import Link from "next/link";
import { Plane } from "lucide-react";
import type { Holiday } from "./types";

interface Props {
  holiday: Holiday;
}

function formatRange(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const start = new Date(startIso).toLocaleDateString("en-GB", opts);
  const end = new Date(endIso).toLocaleDateString("en-GB", opts);
  return start === end ? start : `${start} – ${end}`;
}

// Holiday balance summary with the next booked break, linking to /me/holiday.
export function HolidayCard({ holiday }: Props) {
  return (
    <Link
      href="/me/holiday"
      className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Holiday
        </span>
        <Plane className="h-4 w-4 text-[#D4A853] opacity-70" />
      </div>
      <div className="mt-1.5 text-xl font-bold text-gray-900">
        {holiday.remaining}
        <span className="text-sm font-medium text-gray-400"> / {holiday.allowance} days left</span>
      </div>
      <div className="mt-0.5 text-xs text-gray-400">
        {holiday.nextHoliday
          ? `Next: ${formatRange(holiday.nextHoliday.startDate, holiday.nextHoliday.endDate)}`
          : "No holiday booked"}
      </div>
    </Link>
  );
}
