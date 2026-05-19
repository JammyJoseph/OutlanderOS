"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { CommandCenter } from "./_components/CommandCenter";
import { ConnectGoogleBanner } from "./_components/ConnectGoogleBanner";
import { ProjectTasks } from "./_components/ProjectTasks";
import { QuickAccess } from "./_components/QuickAccess";
import type { DashboardData, Suggestion } from "./_components/types";

const EMPTY: DashboardData = {
  user: { id: "", name: "", email: "", role: "MEMBER", holidayAllowance: 25 },
  tasks: [],
  deadlines: [],
  culturalEvents: [],
  shoots: [],
  counts: { overdue: 0, today: 0, week: 0, inProgress: 0 },
  holiday: { allowance: 25, used: 0, remaining: 25 },
  trelloDeals: [],
};

export default function MePage() {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [digest, setDigest] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/me");
      if (!res.ok) throw new Error(`Dashboard failed (${res.status})`);
      const json = (await res.json()) as DashboardData;
      setData({
        user: json.user ?? EMPTY.user,
        tasks: json.tasks ?? [],
        deadlines: json.deadlines ?? [],
        culturalEvents: json.culturalEvents ?? [],
        shoots: json.shoots ?? [],
        counts: json.counts ?? EMPTY.counts,
        holiday: json.holiday ?? EMPTY.holiday,
        trelloDeals: json.trelloDeals ?? [],
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const res = await fetch("/api/dashboard/suggestions", { method: "POST" });
      const json = (await res.json()) as { digest?: string; suggestions?: Suggestion[] };
      setDigest(json.digest ?? "");
      setSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
    } catch {
      setDigest("");
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadSuggestions();
  }, [loadData, loadSuggestions]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f7f7f7]">
        <Loader2 className="h-6 w-6 animate-spin text-[#D4A853]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#f7f7f7]">
        <p className="text-sm text-gray-500">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            loadData();
          }}
          className="flex items-center gap-1.5 rounded-xl bg-[#D4A853] px-4 py-2 text-sm font-semibold text-white"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f7f7f7] p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* First-login nudge — connect personal Google account */}
        <ConnectGoogleBanner />

        {/* Zone 1 — Command Center */}
        <CommandCenter
          data={data}
          digest={digest}
          suggestions={suggestions}
          suggestionsLoading={suggestionsLoading}
        />

        {/* Zone 2 — Projects & Tasks */}
        <ProjectTasks
          tasks={data.tasks}
          deadlines={data.deadlines}
          onChange={loadData}
        />

        {/* Zone 3 — Quick Access */}
        <QuickAccess holiday={data.holiday} />
      </div>
    </div>
  );
}
