"use client";

import { Building2, CalendarClock, Landmark } from "lucide-react";

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

// VAT quarters fall due on 7th Jan / Apr / Jul / Oct.
function nextVat(): Date {
  const now = new Date();
  for (const month of [0, 3, 6, 9]) {
    const candidate = new Date(now.getFullYear(), month, 7);
    if (daysUntil(candidate) >= 0) return candidate;
  }
  return new Date(now.getFullYear() + 1, 0, 7);
}

function countdownLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

interface ReminderRowProps {
  icon: React.ReactNode;
  label: string;
  detail: string;
  countdown: string | null;
  urgent?: boolean;
}

function ReminderRow({ icon, label, detail, countdown, urgent }: ReminderRowProps) {
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        <span className="block truncate text-xs text-gray-400">{detail}</span>
      </span>
      {countdown && (
        <span
          className={`shrink-0 text-xs font-semibold ${
            urgent ? "text-amber-600" : "text-gray-500"
          }`}
        >
          {countdown}
        </span>
      )}
    </li>
  );
}

// Key business dates — payroll, VAT quarters, Companies House confirmation.
// Hardcoded on purpose: a team of 5 doesn't need a compliance engine.
export function BusinessReminders() {
  const payroll = nextPayroll();
  const payrollDays = daysUntil(payroll);
  const vat = nextVat();
  const vatDays = daysUntil(vat);

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Key Business Reminders
      </h2>
      <ul className="mt-2 divide-y divide-gray-50">
        <ReminderRow
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          label="Payroll"
          detail={formatDate(payroll)}
          countdown={countdownLabel(payrollDays)}
          urgent={payrollDays <= 3}
        />
        <ReminderRow
          icon={<Landmark className="h-3.5 w-3.5" />}
          label="VAT return"
          detail={`Quarter due ${formatDate(vat)}`}
          countdown={countdownLabel(vatDays)}
          urgent={vatDays <= 7}
        />
        <ReminderRow
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Companies House confirmation"
          detail="Annual statement"
          countdown="Set date in settings"
        />
      </ul>
    </section>
  );
}
