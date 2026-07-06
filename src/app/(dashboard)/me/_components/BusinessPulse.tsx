"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/ui/error-state";
import {
  Banknote,
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
        <div key={i} className="h-[92px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
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
      className={`rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${
        href ? "transition-colors hover:border-[#c9c9c6] dark:hover:border-[#3a3a3a]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {label}
        </span>
        <span style={{ color: accent }} className="opacity-70">
          {icon}
        </span>
      </div>
      <div className="mt-1.5 truncate text-xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

// Role-aware Business Pulse KPI cards. ADMIN (finance/admin) sees pipeline +
// Xero money; MEMBER (ops/production) sees projects, deliveries, and the next
// shoot. Payroll now lives in the HR sidebar, not here. Fetches
// /api/dashboard/pulse on its own so the rest of the dashboard isn't blocked
// by Xero round-trips.
export function BusinessPulse() {
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setPulse(null);
    try {
      const r = await fetch("/api/dashboard/pulse");
      if (!r.ok) throw new Error(String(r.status));
      setPulse((await r.json()) as PulseData);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <ErrorState
          title="Business pulse unavailable"
          message="Couldn't load your KPIs right now."
          onRetry={load}
        />
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <PulseCard
          label="Active Projects"
          value={pulse.activeProjects}
          sub={`${pulse.activeDealCount} deal${pulse.activeDealCount === 1 ? "" : "s"} · ${pulse.activeProductionCount} production${pulse.activeProductionCount === 1 ? "" : "s"}`}
          icon={<FolderKanban className="h-4 w-4" />}
          accent="#9C7C2E"
          href="/commercial/pipeline"
        />
        <PulseCard
          label="Upcoming Deliveries"
          value={pulse.upcomingDeliveries}
          sub="due in the next 14 days"
          icon={<PackageCheck className="h-4 w-4" />}
          accent="#A93B2E"
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
          accent="#2E5E44"
          href={shoot ? `/production/${shoot.productionId}` : "/production"}
        />
      </div>
    );
  }

  const connectXero = (
    <Link href="/finance" className="font-semibold text-[#2F4B8F] dark:text-[#5B7BC4] hover:underline">
      Connect Xero
    </Link>
  );

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <PulseCard
        label="Pipeline Value"
        value={formatGBP(pulse.pipelineValue)}
        sub={`${pulse.activeDealCount} active deal${pulse.activeDealCount === 1 ? "" : "s"}`}
        icon={<TrendingUp className="h-4 w-4" />}
        accent="#9C7C2E"
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
        accent="#2F4B8F"
      />
      <PulseCard
        label="Bank Balance"
        value={pulse.xeroConnected ? formatGBP(pulse.bankBalance) : connectXero}
        sub={pulse.xeroConnected ? pulse.bankAccountName || "Xero" : "Xero not connected"}
        icon={<Landmark className="h-4 w-4" />}
        accent="#2E5E44"
      />
    </div>
  );
}
