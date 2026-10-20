"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { Stat, StatGrid } from "@/components/os";
import { formatGBP, type PulseData } from "./types";

function Skeleton() {
  return (
    <StatGrid>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-[132px] animate-pulse rounded-2xl bg-surface" />
      ))}
    </StatGrid>
  );
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function payrollCard(p: PulseData["payroll"]) {
  const d = parseISO(p.date);
  return (
    <Stat
      label="Next payroll"
      value={p.daysUntil === 0 ? "Today" : p.daysUntil === 1 ? "Tomorrow" : `${p.daysUntil} days`}
      note={format(d, "EEEE d MMMM")}
    />
  );
}

// Role-aware business pulse. ADMIN sees pipeline and Xero money; MEMBER sees
// projects, deliveries and the next shoot. Both see payroll. Fetches
// /api/dashboard/pulse on its own so the rest of the dashboard isn't held up
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
      <div className="rounded-2xl bg-surface">
        <ErrorState title="Business pulse unavailable" message="Couldn't load your figures right now." onRetry={load} />
      </div>
    );
  }
  if (!pulse) return <Skeleton />;

  if (pulse.role === "MEMBER") {
    const shoot = pulse.nextShoot;
    const shootDate = shoot ? parseISO(shoot.date) : null;
    const shootDays = shootDate ? differenceInCalendarDays(shootDate, new Date()) : null;
    const countdown =
      shootDays === null ? null : shootDays === 0 ? "Today" : shootDays === 1 ? "Tomorrow" : `${shootDays} days`;

    return (
      <StatGrid aria-label="Business pulse">
        <Stat
          label="Active projects"
          value={pulse.activeProjects}
          note={`${plural(pulse.activeDealCount, "deal")} · ${plural(pulse.activeProductionCount, "production")}`}
          href="/commercial/pipeline"
        />
        <Stat label="Deliveries" value={pulse.upcomingDeliveries} note="Due in the next 14 days" />
        <Stat
          label="Next shoot"
          value={shoot && countdown ? countdown : "None booked"}
          note={shoot && shootDate ? `${shoot.title} · ${format(shootDate, "d MMM")}` : "Schedule one in Production"}
          href={shoot ? `/production/${shoot.productionId}` : "/production"}
        />
        {payrollCard(pulse.payroll)}
      </StatGrid>
    );
  }

  return (
    <StatGrid aria-label="Business pulse">
      <Stat
        label="Pipeline value"
        value={formatGBP(pulse.pipelineValue)}
        note={plural(pulse.activeDealCount, "active deal")}
        href="/commercial"
      />
      <Stat
        label="Owed to us"
        value={pulse.xeroConnected ? formatGBP(pulse.outstandingReceivables) : "—"}
        note={pulse.xeroConnected ? plural(pulse.receivableCount, "open invoice") : "Xero not connected"}
        href="/finance"
      />
      <Stat
        label="Bank balance"
        value={pulse.xeroConnected ? formatGBP(pulse.bankBalance) : "—"}
        note={pulse.xeroConnected ? `Xero${pulse.bankAccountName ? ` · ${pulse.bankAccountName}` : ""}` : "Xero not connected"}
        href="/finance"
      />
      {payrollCard(pulse.payroll)}
    </StatGrid>
  );
}
