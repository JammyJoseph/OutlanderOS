"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, CalendarClock, Landmark, TrendingUp } from "lucide-react";
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
}

function PulseCard({ label, value, sub, icon, accent }: CardProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
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
}

// The four Business Pulse KPI cards. Fetches /api/dashboard/pulse on its own
// so the rest of the dashboard isn't blocked by Xero round-trips.
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

  const connectXero = (
    <Link href="/finance" className="font-semibold text-[#3B82F6] hover:underline">
      Connect Xero
    </Link>
  );

  const payday = new Date(pulse.payroll.date);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <PulseCard
        label="Pipeline Value"
        value={formatGBP(pulse.pipelineValue)}
        sub={`${pulse.activeDealCount} active deal${pulse.activeDealCount === 1 ? "" : "s"}`}
        icon={<TrendingUp className="h-4 w-4" />}
        accent="#D4A853"
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
        accent="#3B82F6"
      />
      <PulseCard
        label="Bank Balance"
        value={pulse.xeroConnected ? formatGBP(pulse.bankBalance) : connectXero}
        sub={pulse.xeroConnected ? pulse.bankAccountName || "Xero" : "Xero not connected"}
        icon={<Landmark className="h-4 w-4" />}
        accent="#22A06B"
      />
      <PulseCard
        label="Next Payroll"
        value={
          pulse.payroll.daysUntil === 0 ? "Today" : `in ${pulse.payroll.daysUntil} days`
        }
        sub={payday.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
        icon={<CalendarClock className="h-4 w-4" />}
        accent="#6B7280"
      />
    </div>
  );
}
