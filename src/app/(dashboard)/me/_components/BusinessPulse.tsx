"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  CalendarClock,
  Clapperboard,
  FolderKanban,
  Landmark,
  PackageCheck,
  TrendingUp,
} from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { formatGBP, type PulseData } from "./types";

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-[92px] animate-pulse rounded-xl bg-gray-100" />
      ))}
    </div>
  );
}

interface CardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  accent: string;
  href?: string;
}

function PulseCard({ label, value, sub, icon, accent, href }: CardProps) {
  const body = (
    <div
      className={`rounded-xl border border-gray-100 bg-white p-4 shadow-sm ${
        href ? "transition-shadow hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {label}
        </span>
        <span style={{ color: accent }} className="opacity-70">
          {icon}
        </span>
      </div>
      <div className="mt-1.5 truncate text-xl font-bold text-gray-900">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-gray-400">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function PayrollCard({ payroll }: { payroll: { date: string; daysUntil: number } }) {
  const payday = new Date(payroll.date);
  return (
    <PulseCard
      label="Next Payroll"
      value={payroll.daysUntil === 0 ? "Today" : `in ${payroll.daysUntil} days`}
      sub={payday.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
      icon={<CalendarClock className="h-4 w-4" />}
      accent="#6B7280"
    />
  );
}

// Role-aware Business Pulse KPI cards. ADMIN (finance/admin) sees pipeline +
// Xero money; MEMBER (ops/production) sees projects, deliveries, and the next
// shoot. Fetches /api/dashboard/pulse on its own so the rest of the dashboard
// isn't blocked by Xero round-trips.
export function BusinessPulse() {
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/pulse")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: PulseData) => {
        if (!cancelled) setPulse(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-400 shadow-sm">
        Business pulse unavailable right now.
      </div>
    );
  }
  if (!pulse) return <Skeleton />;

  if (pulse.role === "MEMBER") {
    const shoot = pulse.nextShoot;
    const shootDate = shoot ? parseISO(shoot.date) : null;
    const shootDays = shootDate ? differenceInCalendarDays(shootDate, new Date()) : null;
    const shootCountdown =
      shootDays === null
        ? null
        : shootDays === 0
          ? "Today"
          : shootDays === 1
            ? "Tomorrow"
            : `in ${shootDays} days`;

    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PulseCard
          label="Active Projects"
          value={pulse.activeProjects}
          sub={`${pulse.activeDealCount} deal${pulse.activeDealCount === 1 ? "" : "s"} · ${pulse.activeProductionCount} production${pulse.activeProductionCount === 1 ? "" : "s"}`}
          icon={<FolderKanban className="h-4 w-4" />}
          accent="#ffd700"
          href="/commercial/pipeline"
        />
        <PulseCard
          label="Upcoming Deliveries"
          value={pulse.upcomingDeliveries}
          sub="due in the next 14 days"
          icon={<PackageCheck className="h-4 w-4" />}
          accent="#ff4444"
        />
        <PulseCard
          label="Next Shoot"
          value={shoot && shootCountdown ? shootCountdown : "No shoots scheduled"}
          sub={
            shoot && shootDate
              ? `${shoot.title} · ${format(shootDate, "d MMM")}`
              : "Schedule one in Production"
          }
          icon={<Clapperboard className="h-4 w-4" />}
          accent="#22A06B"
          href={shoot ? `/production/${shoot.productionId}` : "/production"}
        />
        <PayrollCard payroll={pulse.payroll} />
      </div>
    );
  }

  const connectXero = (
    <Link href="/finance" className="font-semibold text-[#4d9fff] hover:underline">
      Connect Xero
    </Link>
  );

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <PulseCard
        label="Pipeline Value"
        value={formatGBP(pulse.pipelineValue)}
        sub={`${pulse.activeDealCount} active deal${pulse.activeDealCount === 1 ? "" : "s"}`}
        icon={<TrendingUp className="h-4 w-4" />}
        accent="#ffd700"
      />
      <PulseCard
        label="Receivables"
        value={pulse.xeroConnected ? formatGBP(pulse.outstandingReceivables) : connectXero}
        sub={
          pulse.xeroConnected
            ? `${pulse.receivableCount} open invoice${pulse.receivableCount === 1 ? "" : "s"}`
            : "Xero not connected"
        }
        icon={<Banknote className="h-4 w-4" />}
        accent="#4d9fff"
      />
      <PulseCard
        label="Bank Balance"
        value={pulse.xeroConnected ? formatGBP(pulse.bankBalance) : connectXero}
        sub={pulse.xeroConnected ? pulse.bankAccountName || "Xero" : "Xero not connected"}
        icon={<Landmark className="h-4 w-4" />}
        accent="#22A06B"
      />
      <PayrollCard payroll={pulse.payroll} />
    </div>
  );
}
