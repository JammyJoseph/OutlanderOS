"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
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
    <div className="min-h-full bg-[#0a0a0a] p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-8 w-72 animate-pulse rounded-lg bg-gray-100" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[65fr_35fr]">
          <div className="h-72 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-72 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

export default function MePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/me");
      if (!res.ok) throw new Error(`Dashboard failed (${res.status})`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (error && !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0a0a0a]">
        <p className="text-sm text-gray-500">{error}</p>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 rounded-xl bg-[#ffd700] px-4 py-2 text-sm font-semibold text-black"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  if (!data) return <PageSkeleton />;

  const firstName = data.user.name.split(" ")[0] || data.user.name;

  return (
    <div className="min-h-full bg-[#0a0a0a] p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Top strip — greeting + date */}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900">
            {greeting()}, {firstName}
          </h1>
          <span className="text-sm text-gray-400">{todayLabel()}</span>
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
