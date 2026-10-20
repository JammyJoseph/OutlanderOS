"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { getJson, isSessionExpired } from "@/lib/session-fetch";
import { useUser } from "@/components/user-context";
import { Page, PageHead, Split, StatGrid, pill } from "@/components/os";
import { BusinessPulse } from "./_components/BusinessPulse";
import { WeatherHeadlines, loadBrief } from "./_components/WeatherHeadlines";
import { CultureFeed } from "./_components/CultureFeed";
import { PersonalHR } from "./_components/PersonalHR";
import { DeadlinesPanel } from "./_components/DeadlinesPanel";
import { OutstandingItems } from "./_components/OutstandingItems";
import { ActionTrackPanel } from "@/components/tasks/ActionTrackPanel";
import { UpcomingList } from "./_components/UpcomingList";
import { WeekStrip } from "./_components/WeekStrip";
import type { DashboardData } from "./_components/types";

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/London" }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date());
}

function PageSkeleton() {
  return (
    <Page>
      <div className="space-y-3">
        <div className="h-5 w-64 animate-pulse rounded-md bg-surface" />
        <div className="h-10 w-80 animate-pulse rounded-lg bg-surface" />
      </div>
      <StatGrid>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[132px] animate-pulse rounded-2xl bg-surface" />
        ))}
      </StatGrid>
      <Split main={<div className="h-80 animate-pulse rounded-2xl bg-surface" />} side={<div className="h-80 animate-pulse rounded-2xl bg-surface" />} />
    </Page>
  );
}

export default function MePage() {
  const { user } = useUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weather, setWeather] = useState<string | null>(null);

  useEffect(() => {
    getJson<DashboardData>("/api/dashboard/me")
      .then((next) => {
        setData(next);
        setError(null);
      })
      .catch((e) => {
        // Expired session: already navigating to /login, so keep the skeleton up
        // instead of flashing "Failed to load" on the way out.
        if (isSessionExpired(e)) return;
        setError(e instanceof Error ? e.message : "Failed to load your dashboard");
      });
    loadBrief()
      .then((b) => {
        const w = b.weather;
        if (w?.current) setWeather(`${w.location.split(",")[0]} ${Math.round(w.current.temp)}°, ${w.current.description.toLowerCase()}`);
      })
      .catch(() => {});
  }, []);

  if (error && !data) {
    return (
      <Page>
        <div className="flex flex-col items-start gap-4 rounded-2xl bg-surface p-8">
          <p className="text-[15px] text-ink-2">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className={pill("primary")}>
            <RefreshCw strokeWidth={1.75} /> Try again
          </button>
        </div>
      </Page>
    );
  }

  if (!data) return <PageSkeleton />;

  const firstName = data.user.name.split(" ")[0] || data.user.name;
  const isAdmin = user?.role === "ADMIN" || data.user.role === "ADMIN";

  return (
    <Page>
      <PageHead
        eyebrow={weather ? `${todayLabel()} · ${weather}` : todayLabel()}
        title={`${greeting()}, ${firstName}`}
        actions={
          <>
            <Link href="/me/tasks?new=1" className={pill("primary")}>
              <Plus strokeWidth={1.75} /> New task
            </Link>
            <Link href="/me/holiday" className={pill("secondary")}>
              Book time off
            </Link>
            <Link href="/commercial/pipeline" className={pill("secondary")}>
              New deal
            </Link>
            {isAdmin && (
              <Link href="/finance?tab=invoices" className={pill("secondary")}>
                Approve invoices
              </Link>
            )}
          </>
        }
      />

      <BusinessPulse />

      <Split
        main={
          <>
            <ActionTrackPanel />
            <DeadlinesPanel />
            <OutstandingItems />
          </>
        }
        side={
          <>
            <WeekStrip tasks={data.tasks} shoots={data.shoots} culturalEvents={data.culturalEvents}>
              <UpcomingList items={data.upcoming} />
            </WeekStrip>
            <PersonalHR holiday={data.holiday} />
            <CultureFeed />
            <WeatherHeadlines />
          </>
        }
      />
    </Page>
  );
}
