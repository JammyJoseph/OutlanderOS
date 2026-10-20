"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
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

// Holiday at a glance — days left, how much is used, and the next booking.
// (Payroll moved to the business pulse cards at the top of the page.)
export function PersonalHR({ holiday }: Props) {
  const usedPct = holiday.allowance > 0 ? Math.min(100, (holiday.used / holiday.allowance) * 100) : 0;
  return (
    <section className="rounded-2xl bg-surface px-6 py-6" aria-label="Holiday">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Holiday</h2>
        <Link href="/me/holiday" aria-label="Open holiday" className="-m-2 flex size-10 items-center justify-center rounded-full hover:bg-surface-2">
          <ChevronRight className="size-5" strokeWidth={1.75} />
        </Link>
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold tabular-nums leading-none">{holiday.remaining}</span>
        <span className="text-[15px] text-muted-foreground">of {holiday.allowance} days left</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-foreground" style={{ width: `${usedPct}%` }} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {holiday.nextHoliday ? `Next: ${formatRange(holiday.nextHoliday.startDate, holiday.nextHoliday.endDate)}` : "Nothing booked yet."}
      </p>
    </section>
  );
}
