"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ExternalLink,
  ArrowRight,
  Plus,
  CheckCircle2,
  CircleDashed,
  Clock,
} from "lucide-react";
import { useIssues, type IssueSummary } from "@/components/print/usePlan";
import type { IssueState } from "@/lib/magazine-plan";

const LEGACY_SHEET =
  "https://docs.google.com/spreadsheets/d/1INpLAczQSTp0RdLV2_bPHC_2xO_Jhwy6MUDR2aALjZw";

const STATE_STYLE: Record<IssueState, { text: string; accent: string; icon: React.ReactNode }> = {
  Complete: {
    text: "#34d399",
    accent: "#34d399",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  "In Progress": {
    text: "#fbbf24",
    accent: "#fbbf24",
    icon: <Clock className="h-3 w-3" />,
  },
  Planning: {
    text: "#9ca3af",
    accent: "#6b7280",
    icon: <CircleDashed className="h-3 w-3" />,
  },
};

export default function PrintDashboard() {
  const router = useRouter();
  const { issues, loading, creating, createNextIssue } = useIssues();

  async function handleNewIssue() {
    const plan = await createNextIssue();
    if (plan) router.push(`/print/flat-plan?issue=${plan.issueNumber}`);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-[#00ff88]" />
      </div>
    );
  }

  // The current/next issue is the most recent that isn't yet complete; fall back
  // to the newest issue overall.
  const current =
    issues.find((i) => i.state !== "Complete")?.issueNumber ?? issues[0]?.issueNumber;

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <span className="h-2 w-2 rounded-full bg-[#00ff88]" />
            Print — Outlander Magazine
          </h1>
          <p className="text-xs text-gray-500">
            {issues.length} {issues.length === 1 ? "issue" : "issues"} · all editions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewIssue}
            disabled={creating || !issues.length}
            className="flex items-center gap-1.5 rounded-lg bg-[#00ff88] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#00ff88]/90 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            New Issue
          </button>
          <a
            href={LEGACY_SHEET}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Legacy Sheet
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                isCurrent={issue.issueNumber === current}
              />
            ))}

            {/* New issue tile */}
            <button
              onClick={handleNewIssue}
              disabled={creating || !issues.length}
              className="flex min-h-[164px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card text-gray-500 transition hover:border-[#00ff88]/40 hover:text-[#00ff88] disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
              <span className="text-xs font-semibold">New Issue</span>
              <span className="text-[10px] text-gray-600">Clone the latest structure</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueCard({ issue, isCurrent }: { issue: IssueSummary; isCurrent: boolean }) {
  const st = STATE_STYLE[issue.state];
  return (
    <Link
      href={`/print/flat-plan?issue=${issue.issueNumber}`}
      className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition hover:bg-secondary"
      style={{
        borderColor: isCurrent ? `${st.accent}66` : undefined,
        boxShadow: isCurrent ? `inset 0 0 0 1px ${st.accent}33` : undefined,
      }}
    >
      {isCurrent && (
        <span
          className="absolute right-4 top-4 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ background: `${st.accent}22`, color: st.accent }}
        >
          Current
        </span>
      )}

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold text-foreground">
          {String(issue.issueNumber).padStart(2, "0")}
        </span>
        <span className="text-sm font-semibold text-gray-500">{issue.issueName}</span>
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: st.text }}>
        {st.icon}
        {issue.state}
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px] text-gray-500">
          <span>{issue.totalPages} pages · {issue.stats.sections} features</span>
          <span className="font-mono font-bold" style={{ color: st.accent }}>
            {issue.stats.progressPct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${issue.stats.progressPct}%`, background: st.accent }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[10px] text-gray-500">
        <span>
          Complete <span className="font-mono font-semibold text-gray-300">{issue.stats.completePct}%</span>
        </span>
        <span className="flex items-center gap-1 text-gray-500 transition group-hover:text-[#00ff88]">
          Open <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
