"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Loader2,
  LayoutGrid,
  FileText,
  CheckCircle2,
  Layers,
  Megaphone,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { useMagazinePlan } from "@/components/print/usePlan";
import { SECTIONS, SECTION_KEYS, computeStats, sectionColour } from "@/lib/magazine-plan";

const LEGACY_SHEET =
  "https://docs.google.com/spreadsheets/d/1INpLAczQSTp0RdLV2_bPHC_2xO_Jhwy6MUDR2aALjZw";

export default function PrintDashboard() {
  const { plan, loading } = useMagazinePlan();
  const pages = plan?.pages ?? [];
  const stats = useMemo(() => computeStats(pages), [pages]);

  // Page counts per section for the breakdown bar.
  const breakdown = useMemo(() => {
    const counts = new Map<string, number>();
    pages.forEach((p) => counts.set(p.section, (counts.get(p.section) ?? 0) + 1));
    return SECTION_KEYS.map((k) => ({
      key: k,
      label: SECTIONS[k].label,
      hex: SECTIONS[k].hex,
      count: counts.get(k) ?? 0,
    })).filter((s) => s.count > 0);
  }, [pages]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-6 w-6 animate-spin text-[#00ff88]" />
      </div>
    );
  }

  const blocks = Math.round(pages.length / 8);

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a] text-gray-200">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[#0a0a0a]/90 px-6 py-3 backdrop-blur">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-white">
            <span className="h-2 w-2 rounded-full bg-[#00ff88]" />
            Print — Outlander Magazine
          </h1>
          <p className="text-xs text-gray-500">
            {plan ? `Issue ${String(plan.issueNumber).padStart(2, "0")} · ${plan.issueName}` : "No active issue"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/print/flat-plan" className="flex items-center gap-1.5 rounded-lg bg-[#00ff88] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#00ff88]/90">
            <LayoutGrid className="h-3.5 w-3.5" /> Open Flat Plan
          </Link>
          <a href={LEGACY_SHEET} target="_blank" rel="noopener" className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white">
            <ExternalLink className="h-3.5 w-3.5" /> Legacy Sheet
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
          {/* Page count banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-transparent p-5">
            <div>
              <p className="text-3xl font-bold text-white">
                {pages.length} <span className="text-base font-medium text-gray-500">pages</span>
              </p>
              <p className="text-xs text-gray-500">{blocks} × 8-page sections</p>
            </div>
            <div className="flex items-center gap-3">
              <ProgressRing pct={stats.progressPct} />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Overall Progress</p>
                <p className="text-lg font-bold text-[#00ff88]">{stats.progressPct}%</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat icon={<FileText className="h-4 w-4" />} label="Sections" value={`${stats.sections}`} sub="features planned" />
            <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Content Received" value={`${stats.contentReceivedPct}%`} sub="assets in" accent="#fbbf24" />
            <Stat icon={<Layers className="h-4 w-4" />} label="In Progress" value={`${stats.inProgressPct}%`} sub="being produced" accent="#c084fc" />
            <Stat icon={<Megaphone className="h-4 w-4" />} label="Complete" value={`${stats.completePct}%`} sub="signed off" accent="#34d399" />
          </div>

          {/* Section breakdown */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <h2 className="mb-3 text-sm font-semibold text-white">Page Breakdown by Section</h2>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
              {breakdown.map((s) => (
                <div key={s.key} style={{ width: `${(s.count / pages.length) * 100}%`, background: s.hex }} title={`${s.label}: ${s.count}`} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
              {breakdown.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5 text-gray-400">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.hex }} />
                  {s.label}
                  <span className="font-mono font-semibold text-gray-300">{s.count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Jump to flat plan */}
          <Link href="/print/flat-plan" className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:border-[#00ff88]/30">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${sectionColour("Feature")}22`, color: sectionColour("Feature") }}>
                <LayoutGrid className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Flat Plan & Line Tracker</p>
                <p className="text-xs text-gray-500">Edit the page-by-page plan — spreadsheet and visual views in sync.</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-600 transition group-hover:translate-x-1 group-hover:text-[#00ff88]" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center gap-2 text-gray-500">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-mono text-2xl font-bold" style={{ color: accent ?? "#fff" }}>{value}</p>
      <p className="mt-0.5 text-[10px] text-gray-500">{sub}</p>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke="#00ff88" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
    </svg>
  );
}
