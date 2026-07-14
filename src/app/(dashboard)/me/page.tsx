"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getJson, isSessionExpired } from "@/lib/session-fetch";
import { BusinessPulse } from "./_components/BusinessPulse";
import { WeatherHeadlines } from "./_components/WeatherHeadlines";
import { CultureFeed } from "./_components/CultureFeed";
import { PersonalHR } from "./_components/PersonalHR";
import { DeadlinesPanel } from "./_components/DeadlinesPanel";
import { OutstandingItems } from "./_components/OutstandingItems";
import { QuickLinks } from "./_components/QuickLinks";
import { ActionTrackPanel } from "@/components/tasks/ActionTrackPanel";
import { UpcomingList } from "./_components/UpcomingList";
import { WeekStrip } from "./_components/WeekStrip";
import type { DashboardData } from "./_components/types";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PageSkeleton() {
  return (
    <div className="min-h-full bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-8 w-72 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[65fr_35fr]">
          <div className="h-72 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-72 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    </div>
  );
}

export default function MePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      });
  }, []);

  if (error && !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background">
        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-md bg-[#111111] px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  if (!data) return <PageSkeleton />;

  const firstName = data.user.name.split(" ")[0] || data.user.name;

  return (
    <div className="min-h-full bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Top strip — greeting + date */}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {greeting()}, {firstName}
          </h1>
          <span className="text-sm text-gray-400 dark:text-gray-500">{todayLabel()}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[65fr_35fr]">
          {/* Left column — pulse, tasks, deadlines, quick links */}
          <div className="min-w-0 space-y-4">
            <BusinessPulse />
            <ActionTrackPanel />
            <DeadlinesPanel />
            <QuickLinks counts={data.counts} />
          </div>

          {/* Right column — week, upcoming, weather & headlines, culture, HR */}
          <div className="min-w-0 space-y-4">
            <WeekStrip
              tasks={data.tasks}
              shoots={data.shoots}
              culturalEvents={data.culturalEvents}
            />
            <UpcomingList items={data.upcoming} />
            <WeatherHeadlines />
            <OutstandingItems />
            <CultureFeed />
            <PersonalHR holiday={data.holiday} />
          </div>
        </div>
      </div>
    </div>
  );
}
